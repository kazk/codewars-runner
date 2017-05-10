"use strict";

const fs = require('fs-extra');
const path = require('path');

const Convert = require('ansi-to-html');
const convert = new Convert();

async function solutionOnly(opts) {
  return {
    name: 'crystal',
    args: ['eval', opts.solution]
  };
}

async function testIntegration(opts) {
  const dir = '/home/codewarrior/crystal';

  await fs.outputFile(path.join(dir, 'solution.cr'), opts.solution);
  if (opts.setup) await fs.outputFile(path.join(dir, 'setup.cr'), opts.setup);
  await fs.outputFile(path.join(dir, 'fixture.cr'), opts.fixture);

  await fs.outputFile(path.join(dir, 'spec.cr'), [
    `require "./formatter"`,
    opts.setup ? `require "./setup"` : '',
    `require "./solution"`,
    `require "./fixture"`,
  ].join('\n'));
  return {
    name: 'crystal',
    args: ['spec', 'spec.cr'],
    options: {cwd: dir}
  };
}

function transformBuffer(buffer) {
  buffer.stdout = convert.toHtml(buffer.stdout);
  var finished = buffer.stdout.search(/(?! )\d* examples?/);
  if (finished > 0) {
    buffer.stdout = buffer.stdout.substr(0, finished).replace("Failures:\n", "Failure Summary:\n");
  }
  // crystal likes to write its compile errors to stdout, so lets swap them around
  if (buffer.stdout.indexOf('Error in ') === 0) {
    buffer.stderr = buffer.stdout;
    buffer.stdout = '';
  }
}

const outputType = 'raw';
