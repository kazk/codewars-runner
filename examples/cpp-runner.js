"use strict";

const path = require('path');
const exec = require('child_process').exec;
const fs = require('fs-extra');

const cppDir = path.resolve(__dirname, '..', '..', 'frameworks', 'cpp');
const main = fs.readFileSync(path.resolve(cppDir, 'main.cpp'));

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const dir = path.join(opts.dir, 'cpp');
    if (opts.setup) {
      fs.outputFileSync(path.join(dir, 'setup.h'), opts.setup);
      opts.solution = '#include "setup.h"\n' + opts.solution;
    }
    const executable = path.join(dir, 'solution');
    const solutionFile = path.join(dir, 'solution.cpp');
    const args = [
      `clang++-3.6`,
      `-stdlib=libc++`,
      `-std=c++1y`,
      solutionFile,
      '-o', executable,
    ];
    fs.outputFileSync(solutionFile, opts.solution);
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
    const dir = path.join(opts.dir, 'cpp');
    if (opts.setup) {
      fs.outputFileSync(path.join(dir, 'setup.h'), opts.setup);
      opts.solution = '#include "setup.h"\n' + opts.solution;
    }
    const executable = path.join(dir, 'solution');
    const solutionFile = path.join(dir, 'solution.cpp');
    const args = [
      `clang++-3.6`,
      `-stdlib=libc++`,
      `-std=c++1y`,
      '-isystem', cppDir,
      solutionFile,
      '-o', executable,
    ];
    fs.outputFileSync(solutionFile, [
      '#include <igloo/igloo_alt.h>',
      'using namespace igloo;',
      opts.solution,
      opts.fixture,
      main
    ].join('\n'));

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

function sanitizeStdErr(error, opts) {
  return error.replace(/clang.*-std=c[^\s]+/g, '')
              .replace(/Error: Command failed:/g, '')
              .replace(/\/tmp.*(solution\.cpp|solution)[:0-9]*/g, '')
              .replace('\n', '')
              .replace('  ', ' ')
              .replace(opts.setup || '', '')
              .replace(opts.fixture || '', '');
}
