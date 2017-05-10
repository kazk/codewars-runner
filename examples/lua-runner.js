"use strict";

const fs = require('fs-extra');
const path = require('path');

async function solutionOnly(opts) {
  const solution = path.join(opts.dir, 'solution.lua');
  await fs.outputFile(solution, opts.solution);
  return {
    name: 'lua',
    args: [solution],
    options: {cwd: opts.dir}
  };
}

async function testIntegration(opts) {
  const fixtureFile = path.join(opts.dir, 'fixture.lua');
  await fs.outputFile(path.join(opts.dir, 'solution.lua'), opts.solution);
  if (opts.setup) await fs.outputFile(path.join(opts.dir, 'setup.lua'), opts.setup);
  await fs.outputFile(fixtureFile, opts.fixture);
  return {
    name: 'busted',
    args: [
      fixtureFile,
      `--output=/runner/lua/codewars.lua`,
    ],
    options: {
      cwd: opts.dir
    }
  };
}
