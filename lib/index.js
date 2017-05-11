"use strict";

const child_process = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const processOptions = require('./process-options');

const downloadGithubRepo = require('./features/download-github-repo');
const downloadGist = require('./features/download-gist');
const outputFilesTo = require('./util/output-files-to');
const spawnp = require('./util/spawnp');

module.exports = function createRunner(strategies) {
  return async function(opts) {
    if (strategies.defaultOptions)
      opts = Object.assign({}, strategies.defaultOptions, opts);
    opts = processOptions(opts);
    await doSetup(opts, strategies);
    if (strategies.before) strategies.before(opts);

    const buffer = await run(opts, strategies);
    // TODO Remove the following by running each test in new container
    if (process.env.NODE_ENV == 'test') child_process.execSync('rm -rf /home/codewarrior/*');

    reportBuffer(opts, buffer, strategies);
    return buffer;
  };
};

// given the options provided and a list of strategies on how to handle them, run will pick the
// appropriate strategy and execute it.
async function run(opts, strategies) {
  try {
    return runCode(opts, await strategies[opts.strategy](opts));
  }
  catch (ex) { // compile error from reject(error)
    let err = ex.message || '';
    // don't add stderr if its just a repeat of the error message
    if (ex.stderr && !err.includes(ex.stderr)) err += ex.stderr;
    return {
      stdout: ex.stdout || '',
      stderr: err,
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
  if (typeof strategies.modifyOpts == 'function')
    await strategies.modifyOpts(opts);

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

  if (opts.files) {
    if (typeof strategies.files == 'function') { // use `files` strategy if defined
      await strategies.files(opts);
    }
    else {
      await outputFilesTo(opts.dir, opts.files); // write any optional files to the same directory
    }
  }

  if (opts.bash != null || opts.bashFile != null)
    await runShell(opts);
}

// handles running an optional shell value, which allows users to configure a shell script to be ran
// before the code executes
async function runShell(opts) {
  // if a shellFile was specified, then run that first before any manual shell code
  if (opts.bashFile) {
    opts.bash = `cd ${opts.dir} ; sh ${opts.bashFile}\n${opts.bash || ''}`;
  }
  opts.publish('status', 'Running setup scripts...');
  const filename = path.join(opts.dir, '.runner.sh');
  await fs.outputFile(filename, `#!/bin/bash\n${opts.bash}`);
  opts.shell = await spawnp('bash', [filename], {}, null, {
    timeout: 10000, // allow the shell script its own 10 sec timeout
    publish: (e, s) => {},
  });
}

function runCode(opts, params) {
  return spawnp(params.name, params.args, params.options, params.stdin, opts);
}

function reportBuffer(opts, buffer, strategies) { // strategies != null
  // added as a way to transform the buffer before any additional stdout/err specific processing is made.
  // useful for things like when you may want to split stdout into both stdout and stderr
  if (strategies.transformBuffer) strategies.transformBuffer(buffer, opts);

  // if there is an error, provide the ability to sanitize it. This is useful for when
  // output can be noisy.
  if (buffer.stderr && strategies.sanitizeStdErr) {
    buffer.stderr = strategies.sanitizeStdErr(buffer.stderr, opts);
  }

  if (buffer.stdout && strategies.sanitizeStdOut) {
    buffer.stdout = strategies.sanitizeStdOut(buffer.stdout, opts);
  }

  // return the output of the shell call
  if (opts.shell) buffer.shell = opts.shell;

  // escape the stderr output after strategies have been run
  // and before the it is written to the process stream
  buffer.outputType = strategies.outputType || 'pre';

  if (opts.format == 'json') {
    process.stdout.write(JSON.stringify(buffer));
  }
  else {
    if (buffer.stdout) process.stdout.write(buffer.stdout);
    if (buffer.stderr) process.stderr.write(buffer.stderr);
    // if (buffer.wallTime && opts.debug) console.info(buffer.wallTime + 'ms');
  }
}
