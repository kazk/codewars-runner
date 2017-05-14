"use strict";

const path = require('path');
const fs = require('fs-extra');

async function solutionOnly(opts) {
  const file = path.join(opts.dir, 'solution.sh');
  await fs.outputFile(file, opts.solution);
  return {
    name: opts.languageVersion || 'sh',
    args: [file]
  };
}

async function testIntegration(opts) {
  process.env.SHELL = opts.languageVersion || 'sh';
  if (!opts.projectMode) {
    opts.setup = [
      `require '/runner/frameworks/ruby/shell'`,
      `${opts.setup || ''}`,
    ].join('\n');
    opts.solution = "#";
    opts.fixture = `\`rm -rf /workspace/fixture.rb\` ; ${opts.fixture}`;
  }
  return useRSpec(opts);
}

// shared with ruby
async function useRSpec(opts) {
}
