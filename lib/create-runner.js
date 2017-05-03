"use strict";

const child_process = require('child_process');
const spawn = child_process.spawn;
const path = require('path');
const fs = require('fs-extra');

const processOptions = require('./process-options');

const downloadGithubRepo = require('./features/download-github-repo');
const downloadGist = require('./features/download-gist');
const outputFilesTo = require('./util/output-files-to');

module.exports = function createRunner(strategies) {
  return async function(opts) {
    opts = processOptions(opts);
    await doSetup(opts, strategies);
    const buffer = await run(opts, strategies);
    // TODO Remove the following by running each test in new container
    if (process.env.NODE_ENV == 'test') child_process.execSync('rm -rf /home/codewarrior/*');
    return reportBuffer(opts, buffer, strategies);
  };
};

// given the options provided and a list of strategies on how to handle them, run will pick the
// appropriate strategy and execute it.
async function run(opts, strategies) {
  try {
    if (strategies.before) strategies.before(opts);
    return runCode(opts, await strategies[opts.strategy](opts));
  }
  catch (ex) { // compile error from reject(error)
    let err = ex.message;
    // don't add stderr if its just a repeat of the error message
    if (ex.stderr && !err.includes(ex.stderr)) err += ex.stderr;
    return {
      stdout: ex.stdout || '',
      stderr: err ? err + '\n' : '',
      wallTime: 0,
      exitCode: ex.code,
      exitSignal: ex.signal,
      compilationFailure: true
    };
  }
}

async function doSetup(opts, strategies) {
  // this won't be present in multi-file support cases
  if (opts.solution) {
    // write the solution to a text file so that it can be inspected if need be
    await fs.outputFile(path.join(opts.dir, 'solution.txt'), opts.solution);
  }

  // allow for language level modification of opts, such as services and shell
  if (typeof strategies.modifyOpts == 'function') strategies.modifyOpts(opts);

  if (opts.services.length != 0) {
    opts.publish('status', 'Starting services...');
    await Promise.all(opts.services.map(s => strategies.startService(s, opts)));
  }

  if (opts.githubRepo) {
    await downloadGithubRepo(opts);
  }
  else if (opts.gist) {
    await downloadGist(opts);
  }

  if (opts.files) await setupFiles(opts, strategies);

  if (opts.bash != null || opts.bashFile != null)
    await runShell(opts, 'Running setup scripts...');
}

// if files are included, by default it will just write them to the working directory. If
// a files strategy is defined however, it will call that method instead.
function setupFiles(opts, strategies) {
  if (!strategies.files)
    return outputFilesTo(opts.dir, opts.files); // write any optional files to the same directory

  return new Promise((resolve, reject) => {
    strategies.files(opts);
    resolve();
  });
}

// handles running an optional shell value, which allows users to configure a shell script to be ran
// before the code executes
function runShell(opts, status) {
  return new Promise((resolve, reject) => {
    // if a shellFile was specified, then run that first before any manual shell code
    if (opts.bashFile) {
      opts.bash = `cd ${opts.dir} ; sh ${opts.bashFile}\n${opts.bash || ''}`;
    }
    // if a shell script is provided then run it now
    opts.publish('status', status || 'Running setup scripts...');
    const filename = path.join(opts.dir, '.runner.sh');
    fs.outputFileSync(filename, `#!/bin/bash\n${opts.bash}`);
    exec({
      timeout: 10000, // allow the shell script its own 10 sec timeout
      compiling: true, // set to true so that the script doesn't exit
      publish: (e, s) => {},
    }, 'bash', [filename], {}, null)
    .then(function(result) {
      opts.shell = result;
      resolve();
    });
  });
}


function runCode(opts, params) {
  return exec(opts, params.name, params.args, params.options, params.stdin);
}

// exec is child_process.spawn with buffering and timeout
// TODO handle multibyte characters correctly. `child.stdout.setEncoding('utf8');`
function exec(opts, name, args, cpOpts, processStdin) {
  return new Promise((cb, reject) => {
    opts.publish("status", "Running...");

    var child = spawn(name, args || [], cpOpts);
    var buffer = {stdout: '', stderr: ''};
    var finished = false;
    var stdoutLength = 0;
    var maxTime = opts.timeout || 12000;

    const start = process.hrtime();
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
        const msg = 'Max Buffer reached: Too much information has been written to stdout.';
        opts.publish('stdout', msg);
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
      const diff = process.hrtime(start); // [seconds, nanoseconds]

      finished = true;
      buffer.exitCode = code;
      buffer.exitSignal = signal;
      buffer.wallTime = Math.ceil(diff[0]*1e3 + diff[1]*1e-6);
      cb(buffer);

      // if we are within the run script
      // this makes the test exit at first test if the file is named /run*.js
      // if (!opts.compiling && (process.argv[1] || '').indexOf('/run') >= 0) {
      //   //ensure that node exits now, even if processes have forked off
      //   process.exit(0);
      // }
    }

    child.stdin.end();
  });
}

// Get the time left in a set timeout
// http://stackoverflow.com/questions/3144711/find-the-time-left-in-a-settimeout
function getTimeLeft(timeout) {
  return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
}

function reportBuffer(opts, buffer, strategies) { // strategies != null
  // added as a way to transform the buffer before any additional stdout/err specific processing is made.
  // useful for things like when you may want to split stdout into both stdout and stderr
  if (strategies.transformBuffer) strategies.transformBuffer(buffer);

  // if there is an error, provide the ability to sanitize it. This is useful for when
  // output can be noisy.
  if (buffer.stderr && strategies.sanitizeStdErr) {
    buffer.stderr = strategies.sanitizeStdErr(buffer.stderr);
  }

  if (buffer.stdout && strategies.sanitizeStdOut) {
    buffer.stdout = strategies.sanitizeStdOut(buffer.stdout);
  }

  // return the output of the shell call
  if (opts.shell) buffer.shell = opts.shell;

  // escape the stderr output after strategies have been run
  // and before the it is written to the process stream
  buffer.outputType = strategies.outputType || 'pre';

  if (opts.format == 'json') {
    writeToStream(process.stdout, JSON.stringify(buffer), "\\n");
  }
  else {
    if (buffer.stdout) process.stdout.write(buffer.stdout);
    if (buffer.stderr) process.stderr.write(buffer.stderr);
    // if (buffer.stdout) writeToStream(process.stdout, buffer.stdout, "\n");
    // if (buffer.stderr) writeToStream(process.stderr, buffer.stderr, "\n");
    // if (buffer.wallTime && opts.debug) console.info(buffer.wallTime + 'ms');
  }
  return buffer;
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
