"use strict";

const path = require('path');
const fs = require('fs-extra');
const exec = require('child_process').exec;

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const code = opts.setup ? `${opts.setup}\n${opts.solution}` : opts.solution;
    const solutionFile = path.join(opts.dir, 'solution.ts');
    fs.outputFileSync(solutionFile, code);

    exec('tsc --module commonjs ' + solutionFile, function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      resolve({
        name: 'node',
        args: [solutionFile.replace('.ts', '.js')]
      });
    });
  });
}

const supported = t => t == 'mocha' || t == 'mocha_bdd' || t == 'mocha_tdd';
function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    if (!supported(opts.testFramework))
      return reject(new Error(`Unsupported test framework: ${opts.testFramework}`));

    const mode = opts.testFramework == 'mocha_tdd' ? 'tdd' : 'bdd';
    const code = opts.setup ? `${opts.setup}\n${opts.solution}` : opts.solution;

    const codeFile = path.join(opts.dir, 'solution.ts');
    fs.outputFileSync(codeFile, code);

    exec('tsc --module commonjs ' + codeFile, function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));

      const specFile = path.join(opts.dir, 'spec.ts');
      fs.outputFileSync(specFile, opts.fixture);

      exec('tsc --module commonjs ' + specFile, function(error, stdout, stderr) {
        if (error) return reject(Object.assign(error, {stdout, stderr}));
        resolve({
          name: 'mocha',
          args: [
            '-t', opts.timeout || 7000,
            '-u', mode,
            '-R', 'mocha-reporter',
            specFile.replace('.ts', '.js')
          ]
        });
      });
    });
  });
}

function transformBuffer(buffer, opts) {
  if (buffer.stdout) buffer.stdout = sanitize(buffer.stdout, opts);
  if (buffer.stderr) buffer.stderr = sanitize(buffer.stderr, opts);
}

function sanitize(error, opts) {
  return error.replace(/(\()?\/codewars\/[(\w\/-\d.js:) ;]*/g, '')
              .replace(/( Object. )?[\(]?\[eval\][-:\w\d\)]* at/g, '')
              .replace(/Module._compile.*/g, '')
              .replace('Object.Test.handleError ', '')
              .replace('  ', ' ');
}
