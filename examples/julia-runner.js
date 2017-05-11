"use strict";

const path = require('path');
const fs = require('fs-extra');

async function solutionOnly(opts) {
  if (opts.setup)
    await fs.outputFile(path.join(opts.dir, getFileName(opts.setup, 'setup.jl')), opts.setup);

  return {
    name: 'julia',
    args: [
      '-P', `push!(LOAD_PATH, "${opts.dir}", "frameworks/julia")`,
      '-e', opts.solution
    ]
  };
}

async function testIntegration(opts) {
  await fs.outputFile(path.join(opts.dir, 'solution.jl'), opts.solution);
  if (opts.setup)
    await fs.outputFile(path.join(opts.dir, getFileName(opts.setup, 'setup.jl')), opts.setup);

  const runCmd = [
    `include("frameworks/julia/Test.jl")`,
    `include("${path.join(opts.dir, 'solution.jl')}")`,
    `using Test`,
    `${opts.fixture}`,
  ].join('\n');

  return {
    name: 'julia',
    args: ['-ie', runCmd]
  };
}

function getFileName(code, fallback) {
  const m = /module\s+([a-zA-Z][a-zA-Z\d]*)\W/.exec(code);
  if (m !== null) return m[1] + '.jl';
  return fallback;
}
