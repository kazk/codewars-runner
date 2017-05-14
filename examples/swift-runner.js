"use strict";

const fs = require('fs-extra');
const path = require('path');

async function solutionOnly(opts) {
  const file = path.join(opts.dir, 'solution.swift');
  fs.outputFileSync(file, [
    opts.setup ? opts.setup : '',
    opts.solution
  ].join("\n"));
  return {
    name: 'swift',
    args: [file]
  };
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    if (opts.testFramework != 'xctest')
      return reject(new Error(`Unsupported test framework: ${opts.testFramework}`));

    const code = [opts.solution];
    if (opts.setup) code.unshift(opts.setup.trim());
    if (opts.fixture) {
      // if the xctest import statement was provided, then auto include it
      if (!opts.fixture.includes('import XCTest')) code.push('import XCTest');
      code.push(opts.fixture);
    }
    const file = path.join(opts.dir, 'solution.swift');
    fs.outputFileSync(file, code.join('\n'));
    resolve({
      name: 'swift',
      args: [file]
    });
  });
}

function sanitizeStdErr(err, opts) {
  const setup = opts.setup ? opts.setup.split('\n').length : 0;
  const code = opts.solution.split('\n').length;
  const fixtureOffset = !opts.fixture.includes('import XCTest') ? 1 : 0;
  // We need to change some of the line reporting to make it more useful
  return err.replace(/solution.swift:(\d*):(\d*):/g, function(text, line, ch) {
    // convert line to an integer and make it zero based
    const r = parseInt(line, 10);
    if (setup > 0 && r <= setup) return `${text}(setup)`;
    if (setup > 0 && r <= setup + code) return `${text}(solution:${r - setup}:${ch})`;
    if (r > setup + code) return `${text}(fixture:${r - setup - code - fixtureOffset}:${ch})`;
    return text;
  });
}
