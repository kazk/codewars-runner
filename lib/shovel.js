"use strict";

const child_process = require('child_process');
const spawn = child_process.spawn;
const path = require('path');
const fs = require('fs-extra');

const services = require('./services');
const options = require('./options');
const util = require('./util');
const downloadFromGitHub = require('./features/download-from-github');
const outputFilesTo = require('./util/output-files-to');

module.exports.start = start;

// runs the strategy specified in opts and reports the results of the run, then runs the callback
function start(opts, strategies) {
  return new Promise((resolve, reject) => {
    opts = options.process(opts);
    run(opts, strategies, function(buffer) {
      reportBuffer(opts, buffer, strategies);
      resolve(buffer);
      // if in test environment then cleanup any files
      if (process.env.NODE_ENV === 'test') cleanup();
      opts.onCompleted.forEach(f => f(buffer));
    });
  });
}

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
    fs.outputFileSync(path.join(opts.dir, 'solution.txt'), opts.code || opts.solution);
  }

  // allow for language level modification of opts, such as services and shell
  if (strategies.modifyOpts) strategies.modifyOpts(opts);
  if (opts.services.length != 0) opts.publish('status', 'Starting services...');

  services.start(opts)
  .then(function() {
    downloadFromGitHub(opts)
    .then(function() {
      setupFiles(opts, strategies)
      .then(function() {
        runShell(opts, 'Running setup scripts...')
        .then(function() {
          try {
            if (strategies.before) strategies.before();

            if (opts.files && opts.files['.runner/run.js'] && opts.customRunner) {
              const customStrategy = require(opts.dir + '/.runner/run.js');
              Object.assign(strategies, customStrategy(opts));
              strategies.custom(runCode, fail);
            }
            else {
              // if a fixture was provided (or no solution was) then use testIntegration mode
              const strategy = strategies[opts.strategy];
              strategy(runCode, fail);
            }
          }
          catch (ex) {
            fail(ex);
          }
        });
      });
    });
  });
}

// if files are included, by default it will just write them to the working directory. If
// a files strategy is defined however, it will call that method instead.
function setupFiles(opts, strategies) {
  if (!opts.files) return Promise.resolve();
  if (!strategies.files)
    return outputFilesTo(opts.dir, opts.files); // write any optional files to the same directory

  return new Promise((resolve, reject) => {
    strategies.files();
    resolve();
  });
}

// handles running an optional shell value, which allows users to configure a shell script to be ran
// before the code executes
function runShell(opts, status) {
  if (opts.bash == null && opts.bashFile == null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // if a shellFile was specified, then run that first before any manual shell code
    if (opts.bashFile) {
      opts.bash = `cd ${opts.dir} ; sh ${opts.bashFile}\n${opts.bash || ''}`;
    }
    // if a shell script is provided then run it now
    opts.publish('status', status || 'Running setup scripts...');
    const file = util.codeWriteSync('bash', `#!/bin/bash\n${opts.bash}`, opts.dir, '.runner.sh');
    exec({
      timeout: 10000, // allow the shell script its own 10 sec timeout
      compiling: true // set to true so that the script doesn't exit
    }, 'bash', [file], {}, null, function(result) {
      opts.shell = result;
      resolve();
    });
  });
}

function cleanup() {
  child_process.execSync('rm -rf /home/codewarrior/*');
}

function exec(opts, name, args, processOptions, processStdin, cb) {
  opts.publish = opts.publish || function() {};

  opts.publish("status", "Running...");

  var child = spawn(name, args || [], processOptions);
  var buffer = {stdout: '', stderr: ''};
  var start = new Date();
  var finished = false;
  var stdoutLength = 0;
  var maxTime = opts.timeout || 12000;

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
    // this makes the test exit at first test if the file is named /run*.js
    // if (!opts.compiling && (process.argv[1] || '').indexOf('/run') >= 0) {
    //   //ensure that node exits now, even if processes have forked off
    //   process.exit(0);
    // }
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
