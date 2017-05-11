"use strict";

const path = require('path');
const fs = require('fs-extra');

async function solutionOnly(opts) {
  const file = path.join(opts.dir, 'code.d');
  await fs.outputFile(file, opts.solution);
  return {
    name: 'dmd',
    args: ['-run', file],
    options: {
      cwd: opts.dir
    }
  };
}
