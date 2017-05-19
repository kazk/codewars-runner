"use strict";

const fs = require('fs-extra');
const path = require('path');
const exec = require('child_process').exec;

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const executable = path.join(opts.dir, 'solution');
    const solutionFile = path.join(opts.dir, 'solution.c');
    fs.outputFileSync(solutionFile, opts.solution);
    const args = [
      'clang-3.6',
      '-std=c11',
      solutionFile,
      '-o', executable,
      '-lm'
    ];
    if (opts.setup) {
      const setupFile = path.join(opts.dir, 'setup.c');
      fs.outputFileSync(setupFile, opts.setup);
      args.push(setupFile);
    }

    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      opts.publish('stdout', stdout);
      resolve({
        name: executable,
        args: []
      });
    });
  });
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    const executable = path.join(opts.dir, 'solution');
    const solutionFile = path.join(opts.dir, 'solution.c');
    const fixtureFile = path.join(opts.dir, 'fixture.c');

    fs.outputFileSync(solutionFile, opts.solution);
    fs.outputFileSync(fixtureFile, opts.fixture);
    const args = [
      'clang-3.6',
      '-std=c11',
      fixtureFile, solutionFile,
      '-o', executable,
      './frameworks/c/criterion.c',
      '-I./frameworks/c',
      '-lcriterion',
      '-lm'
    ];
    if (opts.setup) {
      const setupFile = path.join(opts.dir, 'setup.c');
      fs.outputFileSync(setupFile, opts.setup);
      args.push(setupFile);
    }
    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      opts.publish('stdout', stdout);
      resolve({
        name: executable,
        args: ['-q', '-j1']
      });
    });
  });
}

function transformBuffer(buffer, opts) {
  if (buffer.stderr) buffer.stderr = sanitizeStdErr(buffer.stderr, opts);
}

function sanitizeStdErr(error, opts) {
  return error.replace(/clang.*-std=c[^\s]+/g, '')
              .replace(/Error: Command failed:/g, '')
              .replace(/\/tmp.*(solution\.c|solution)[:0-9]*/g, '')
              .replace('\n', '')
              .replace('  ', ' ')
              .replace(opts.setup || '', '')
              .replace(opts.fixture || '', '');
}
