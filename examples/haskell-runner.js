"use strict";

const path = require('path');
const fs = require('fs-extra');

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const dir = path.join(opts.dir, 'haskell');
    if (opts.setup)
      fs.outputFileSync(path.join(dir, getFileName(opts.setup, 'Setup.hs')), opts.setup);

    const solutionFile = getFileName(opts.solution, 'Main.hs');
    fs.outputFileSync(solutionFile, opts.solution);
    resolve({
      name: 'runhaskell',
      args: [
        '-i' + ['/runner/frameworks/haskell', dir].join(':'),
        solutionFile,
      ],
    });
  });
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    const dir = path.join(opts.dir, 'haskell');
    if (opts.setup)
      fs.outputFileSync(path.join(dir, getFileName(opts.setup, 'Setup.hs')), opts.setup);

    const solutionFileName = path.join(dir, getFileName(opts.solution, 'Main.hs'));
    const fixtureFileName = path.join(dir, getFileName(opts.fixture, 'Main.hs'));
    if (solutionFileName.endsWith('/Main.hs') && fixtureFileName.endsWith('/Main.hs'))
      return reject(new Error('Invalid module name'));

    fs.outputFileSync(solutionFileName, opts.solution);
    fs.outputFileSync(fixtureFileName, opts.fixture);
    process.env.solutionFileName = solutionFileName;
    resolve({
      name: 'runhaskell',
      args: ['-i' + ['/runner/frameworks/haskell', dir].join(':'), fixtureFileName],
      options: {env: process.env}
    });
  });
}

function getFileName(code, fallback) {
  const m = /module\s+([A-Z]([a-z|A-Z|0-9]|\.[A-Z])*)\W/.exec(code);
  if (m !== null) return m[1].replace(/\./g, '/').replace(/-/g, '_') + '.hs';
  return fallback;
}
