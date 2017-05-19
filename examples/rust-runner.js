"use strict";

const fs = require('fs-extra');
const path = require('path');
const exec = require('child_process').exec;

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const code = `${opts.setup ? opts.setup+'\n' : ''}${opts.code}`;
    fs.outputFileSync(path.join(opts.dir, 'main.rs'), code);

    exec(`rustc main.rs`, {cwd: opts.dir}, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, {stdout, stderr}));
      resolve({
        name: `./main`,
        options: {
          cwd: opts.dir
        }
      });
    });
  });
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    if (opts.testFramework != 'rust')
      return reject(new Error('Test framework is not supported'));
    const code = `${opts.setup ? opts.setup+'\n' : ''}${opts.code}\n${opts.fixture}`;
    fs.outputFileSync(path.join(opts.dir, 'main.rs'), code);

    exec(`rustc main.rs --test`, {cwd: opts.dir}, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, {stdout, stderr}));
      resolve({
        name: `./main`,
        options: {
          cwd: opts.dir
        }
      });
    });
  });
}

function transformBuffer(buffer, opts) {
  if (opts.testFramework != 'rust') return;

  // if tests failed then just output the entire raw test spec results so that the full details can be viewed
  if (!buffer.stderr && buffer.stdout.indexOf('FAILED') > 0 && buffer.stdout.indexOf('failures:') > 0) {
    buffer.stderr = buffer.stdout.substr(buffer.stdout.indexOf('failures:') + 10).replace("note: Run with `RUST_BACKTRACE=1` for a backtrace.", '');
    // trim after the first failures section
    buffer.stderr = "Failure Info:\n" + buffer.stderr.substr(0, buffer.stderr.indexOf('failures:'));
    if (opts.setup) {
      buffer.stderr += "\nNOTE: Line numbers reported within errors will not match up exactly to those shown within your editors due to concatenation.";
    }
  }
  if (buffer.stdout) buffer.stdout = sanitizeStdOut(buffer.stdout, opts);
}

function sanitizeStdOut(stdout, opts) {
  if (!opts.fixture) return stdout;
  let output = '';
  let tests = stdout.split(/\n/gm).filter(v => !v.search(/^test.*(?:ok|FAILED)$/));
  for (let test of tests) output += _parseTest(test);
  return output;
}

function _parseTest(test) {
  let result = test.split(' ');
  let out = `<DESCRIBE::>${result[1]}\n`;
  out += result[3] != 'FAILED' ? `<PASSED::>Test Passed\n` : `<FAILED::>Test Failed\n`;
  return out;
}
