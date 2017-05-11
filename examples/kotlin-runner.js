"use strict";

const path = require('path');
const fs = require('fs-extra');
const exec = require('child_process').exec;

const KOTLIN_BASE = '/usr/local/lib/kotlin/kotlinc/bin/';
const KOTLIN = KOTLIN_BASE + 'kotlin';
const KOTLINC = KOTLIN_BASE + 'kotlinc';

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const classDirectory = path.join(opts.dir, 'classes');
    const solutionFile = path.join(opts.dir, getFileName(opts.solution, 'Solution.kt'));
    const solutionClassName = path.basename(solutionFile, '.kt');
    const args = [KOTLINC, '-d', classDirectory, solutionFile];
    if (opts.setup) {
      const setupFile = path.join(opts.dir, getFileName(opts.setup, 'Setup.kt'));
      fs.outputFileSync(setupFile, opts.setup);
      args.push(setupFile);
    }
    fs.ensureDirSync(classDirectory);

    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      resolve({
        name: KOTLIN,
        args: ['-classpath', classDirectory, solutionClassName + 'Kt']
      });
    });
  });
}

function getFileName(code, fallback) {
  const m = /(?:object|class)\s+([A-Z][a-zA-Z\d_]*)/.exec(code);
  if (m !== null) return m[1] + '.kt';
  return fallback;
}
