"use strict";

var util = require('./util');
var child_process = require('child_process');
var spawn = child_process.spawn;
var spawnSync = child_process.spawnSync;
var config = require('./config');
var temp = require('temp');
var services = require('./services');
var options = require('./options');

//runs the strategy specified in opts and reports the results of the run, then runs the callback
module.exports.start = function start(opts, cb, strategies) {
  // if in test environment then cleanup any previous files before we get going
  if (process.env.NODE_ENV === 'test') cleanup();

  opts = options.process(opts);

  cb = cb || function() {};
  run(opts, strategies, function(buffer) {
    reportBuffer(opts, buffer, strategies);
    cb(buffer);

    opts.onCompleted.forEach(f => f(buffer));
  });
};

// given the options provided and a list of strategies on how to handle them, run will pick the
// appropriate strategy and execute it.
function run(opts, strategies, cb) {
  // this is the "run/exec" method that is passed in to the shovel methods as the callback.
  function runCode(params) {
    exec(opts, params.name, params.args, params.options, params.stdin, cb);
  }

  // called if the compile process fails
  function fail(error, stdout, stderr) {
    // if params is an object with stdout/err values, then assume its already been processed within the language specific runner
    if (error.stdout || error.stderr) {
      error.compilationFailure = true;
      cb(error);
    }
    else {
      // if an error is passed in, then this is an execution error probably happening due to a compilation issue
      var err = error.toString();
      // don't add stderr if its just a repeat of the error message
      if (stderr && err.indexOf(stderr) == -1) err += stderr;

      cb({
        stdout: stdout || '',
        stderr: err,
        wallTime: 0,
        exitCode: error.code,
        exitSignal: error.signal,
        compilationFailure: true
      });
    }
  }

  // this won't be present in multi-file support cases
  if (opts.code || opts.solution) {
    // write the solution to a text file so that it can be inspected if need be
    util.codeWriteSync(null, opts.code || opts.solution, opts.dir, 'solution.txt', true);
  }

  var hasServices = !!opts.services.length;
  if (hasServices) opts.publish('status', 'Starting services...');

  // allow for language level modification of opts, such as services and shell
  if (strategies.modifyOpts) {
    strategies.modifyOpts(opts);
  }

  services.start(opts, function() {
    downloadFromGithub(opts, function() {
      setupFiles(opts, strategies);
      runShell(opts, function() {
        try {
          if (strategies.before) strategies.before();

          if (opts.files && opts.files['.runner/run.js'] && opts.customRunner) {
            const customStrategy = require(opts.dir + '/.runner/run.js');
            Object.assign(strategies, customStrategy(opts));
            strategies.custom(runCode, fail);
          }
          else {
            // if a fixture was provided (or no solution was) then use testIntegration mode
            var strategy = strategies[opts.strategy];
            strategy(runCode, fail);
          }
        }
        catch (ex) {
          fail(ex);
        }
      });
    });
  });
}

// if files are included, by default it will just write them to the working directory. If
// a files strategy is defined however, it will call that method instead.
function setupFiles(opts, strategies) {
  if (opts.files) {
    if (strategies.files) {
      strategies.files();
    }
    else {
      // write any optional files to the same directory
      util.writeFilesSync(opts.dir, opts.files, true);
    }
  }
}

// handles running an optional shell value, which allows users to configure a shell script to be ran
// before the code executes
function runShell(opts, resolve, status) {
  // if a shellFile was specified, then run that first before any manual shell code
  if (opts.bashFile) {
    opts.bash = `cd ${opts.dir} ; sh ${opts.bashFile}\n${opts.bash || ''}`;
  }

  // if a shell script is provided then run it now
  if (opts.bash) {
    opts.publish('status', status || 'Running setup scripts...');
    temp.track();
    var file = util.codeWriteSync('bash', `#!/bin/bash\n${opts.bash}`, opts.dir, '.runner.sh'),
      shellOpts = {
        timeout: 10000, // allow the shell script its own 10 sec timeout
        compiling: true // set to true so that the script doesn't exit
      };

    exec(shellOpts, 'bash', [file], {}, null, function(result) {
      opts.shell = result;
      resolve();
    });
  }
  else {
    resolve();
  }
}

function downloadFromGithub(opts, resolve) {
  if (opts.githubRepo) {
    var repo = opts.githubRepo;
    if (repo.indexOf('/tarball') == -1) {
      repo += "/tarball";
    }
    if (repo.indexOf('api.github.com') == -1) {
      repo = 'https://api.github.com/repos/' + repo;
    }

    var dl = {
      publish: opts.publish,
      bash: `
                cd ${opts.dir}
                wget -qO- ${repo} | tar xvz --strip-components=1
            `
    };
    runShell(dl, resolve, 'Downloading files from Github...');
  }
  else if (opts.gist) {
    require("request")({
      url: "https://api.github.com/gists/" + opts.gist,
      headers: {'User-Agent': 'Node-API'},
      json: true
    }, (err, response, body) => {
      if (response && response.statusCode === 200 && body && body.files) {
        Object.keys(body.files).forEach(name => {
          util.writeFileSync(opts.dir, name, body.files[name].content, true);
        });
      }
      resolve();
    });
  }
  else {
    resolve();
  }
}

function cleanup() {
  spawnSync('find' [
    "/home/codewarrior",
    "-mindepth 1",
    "-maxdepth 1",
    "-exec rm -rf {} \\;"
  ], {shell: '/bin/bash'});
}

function exec(opts, name, args, processOptions, processStdin, cb) {
  opts.publish = opts.publish || function() {};

  opts.publish("status", "Running...");

  var child = spawn(name, args || [], processOptions),
    buffer = {stdout: '', stderr: ''},
    start = new Date(),
    finished = false,
    stdoutLength = 0,
    maxTime = opts.timeout || config.timeouts[opts.language] || config.timeouts.default;

  if (processStdin) child.stdin.write(processStdin);

  // Listen
  const KB = 1024;
  const MAX_BUFFER = KB * 1500; // 1.5mb
  const MAX_DATA_BUFFER = KB * 50; //50kb is the max that can be written at once.
  child.stdout.on('data', function(data) {
    if (data) {
      var text = data.toString();
      opts.publish('stdout', text);
      stdoutLength += text.length;
      if (text.length > MAX_DATA_BUFFER) {
        text = text.substr(0, MAX_DATA_BUFFER);
        text += `\nContent truncated due to max data buffer of ${MAX_DATA_BUFFER / KB}kb being reached. Try flushing buffer with less content.\n`;
      }
      buffer.stdout += text;
    }

    if (stdoutLength > MAX_BUFFER) {
      var msg = 'Max Buffer reached: Too much information has been written to stdout.';
      opts.publish(msg);
      buffer.status = 'max_buffer_reached';
      exit(msg);
    }
  });

  child.stderr.on('data', function(data) {
    if (data) {
      var text = data.toString();
      opts.publish('stderr', text);
      buffer.stderr += text;
    }
  });

  child.on('error', exit);

  child.on('exit', function(code, signal) {
    // wait the remaining time left to see if all stdio processes close
    // preferably we cleanup after 'exit' is called
    // only wait up to 1 second though
    setTimeout(function() {
      complete(code, signal);
    }, Math.min(getTimeLeft(timeout), 1000));
  });

  child.on('close', function(code, signal) {
    clearTimeout(timeout);
    complete(code, signal);
  });

  // prevent the process from running for too long
  var timeout = setTimeout(function() {
    if (!finished) {
      buffer.status = 'max_time_reached';
      exit('Process was terminated. It took longer than ' + maxTime + 'ms to complete');
    }
    process.exit(1);
  }, maxTime);

  function exit(reason) {
    if (!finished) {
      child.kill('SIGKILL');
      buffer.exitSignal = 'SIGKILL';
      if (reason) buffer.stderr += reason + '\n';
      finished = true;
    }
    cb(buffer);
  }

  function complete(code, signal) {
    if (finished) return;

    finished = true;
    buffer.exitCode = code;
    buffer.exitSignal = signal;
    buffer.wallTime = new Date() - start;
    cb(buffer);

    // if we are within the run script
    if (!opts.compiling && (process.argv[1] || '').indexOf('/run') >= 0) {
      //ensure that node exits now, even if processes have forked off
      process.exit(0);
    }
  }

  child.stdin.end();
}

// Get the time left in a set timeout
// http://stackoverflow.com/questions/3144711/find-the-time-left-in-a-settimeout
function getTimeLeft(timeout) {
  return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
}

function reportBuffer(opts, buffer, strategies) {
  if (strategies) {
    // added as a way to transform the buffer before any additional stdout/err specific processing is made.
    // useful for things like when you may want to split stdout into both stdout and stderr
    if (strategies.transformBuffer) {
      strategies.transformBuffer(buffer);
    }

    // if there is an error, provide the ability to sanitize it. This is useful for when
    // output can be noisy.
    if (buffer.stderr && strategies.sanitizeStdErr) {
      buffer.stderr = strategies.sanitizeStdErr(buffer.stderr);
    }

    if (buffer.stdout && strategies.sanitizeStdOut) {
      buffer.stdout = strategies.sanitizeStdOut(buffer.stdout);
    }
  }

  // return the output of the shell call
  if (opts.shell) {
    buffer.shell = opts.shell;
  }

  // escape the stderr output after strategies have been run
  // and before the it is written to the process stream

  buffer.outputType = strategies.outputType || 'pre';

  if (opts.format == 'json') {
    writeToStream(process.stdout, JSON.stringify(buffer), "\\n");
  }
  else {
    if (buffer.stdout) writeToStream(process.stdout, buffer.stdout, "\n");
    if (buffer.stderr) writeToStream(process.stderr, buffer.stderr, "\n");
    if (buffer.wallTime && opts.debug) {
      console.info(buffer.wallTime + 'ms');
    }
  }
}

// we need to chunk the data back out to handle strange inconsistency issues with large data.
// Ideally we could chunk based off of character count but for some reason chunking by line breaks
// is the only thing that is consistent.
function writeToStream(stream, data, linebreak) {
  data.split(linebreak).forEach((line, i, arr) => {
    // don't write a line break on the last line
    return stream.write(line.normalize() + (i != arr.length - 1 ? linebreak : ''));
  });
}

// used for indicating an error which is related to user code and not an application error.
// useful for when we run code compilation inside of this host process.
var CompileError = module.exports.CompileError = function(message) {
  this.name = "CompileError";
  this.message = message;
};
CompileError.prototype = Error.prototype;
