"use strict";

const path = require('path');
const fs = require('fs-extra');

async function solutionOnly(opts) {
  return {
    name: 'elixir',
    args: ['-e', `${opts.setup ? opts.setup + '\n' : ''}${opts.solution}`]
  };
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    if (opts.testFramework != 'ex_unit' && opts.testFramework != 'exunit')
      return reject(new Error('Test framework is not supported'));

    const dir = path.join(opts.dir, 'elixir');
    const solution = `${opts.setup ? opts.setup + '\n' : ''}${opts.solution}`;
    const solutionFile = path.join(dir, getFileName(solution, 'solution.ex'));
    const fixtureFile = path.join(dir, getFileName(opts.fixture, 'fixture.ex'));
    fs.outputFileSync(solutionFile, solution);
    fs.outputFileSync(fixtureFile, opts.fixture);
    return resolve({
      name: 'elixir',
      args: [
        '-e',
        [
          `Code.load_file("frameworks/elixir/cw_runner.ex")`,
          `CWRunner.run("${solutionFile}", "${fixtureFile}")`,
        ].join('\n'),
      ]
    });
  });
}

function getFileName(code, defaultFileName) {
  const m = /defmodule\s+([a-zA-Z][.a-zA-Z\d_]*)\s+do/.exec(code);
  if (m !== null) return m[1].replace(/\./g, '/').replace(/-/g, '_') + '.ex';
  return defaultFileName;
}
