"use strict";

const path = require('path');
const fs = require('fs-extra');
const exec = require('child_process').exec;

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const classDirectory = path.join(opts.dir, 'classes');
    const solutionFile = path.join(opts.dir, getFileName(opts.solution, 'Solution.scala'));
    const solutionClassName = path.basename(solutionFile, '.scala');
    const args = ['scalac', '-d', classDirectory, solutionFile];

    fs.outputFileSync(solutionFile, opts.solution);
    if (opts.setup) {
      const setupFile = path.join(opts.dir, getFileName(opts.setup, 'Setup.scala'));
      fs.outputFileSync(setupFile, opts.setup);
      args.push(setupFile);
    }
    fs.ensureDirSync(classDirectory);

    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      resolve({
        name: 'scala',
        args: ['-classpath', classDirectory, solutionClassName]
      });
    });
  });
}

function getFileName(code, fallback) {
  const m = /(?:object|class)\s+([A-Z][a-zA-Z\d_]*)/.exec(code);
  if (m !== null) return m[1] + '.scala';
  return fallback;
}
