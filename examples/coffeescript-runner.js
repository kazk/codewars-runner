"use strict";

async function solutionOnly(opts) {
  return {
    name: 'coffee',
    args: ['-e', [opts.setup ? opts.setup : '', opts.solution].join('\n')]
  };
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    const tf = opts.testFramework;
    if (tf != 'cw' && tf != 'cw-2')
      return reject(new Error(`Unsupported test framework: ${tf}`));

    const code = [
      `require('./frameworks/javascript/cw-2')`,
      `assert = require('assert')`,
      `Test.handleError ->`,
      `${indented(opts.setup, 2)}`,
      `${indented(opts.solution, 2)}`,
      `  do ->`,
      `    Test = global.Test`,
      `    describe = global.describe`,
      `    it = global.it`,
      `    before = global.before`,
      `    after = global.after`,
      `${indented(opts.fixture, 4)}`,
    ].join('\n');
    resolve({
      name: 'coffee',
      args: ['-e', code]
    });
  });
}

function indented(lines, spaces) {
  if (!lines) return '';
  const p = ' '.repeat(spaces);
  return lines.split("\n").map(s => `${p}${s}`).join("\n");
}
