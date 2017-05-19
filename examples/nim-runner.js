"use strict";

const path = require('path');
const fs = require('fs-extra');

async function solutionOnly(opts) {
  const file = path.join(opts.dir, 'solution.nim');
  await fs.outputFile(file, opts.solution);
  return {
    name: 'nim',
    args: nimArgs(file),
    options: {cwd: opts.dir}
  };
}

async function testIntegration(opts) {
  // TODO: look into module paths
  // test relies on /home/codewarrior/codewars/formatter.nim
  const dir = '/home/codewarrior';
  const file = path.join(dir, 'solution.nim');
  const fixture = path.join(dir, 'fixture.nim');
  await fs.outputFile(file, opts.solution);
  await fs.outputFile(fixture, opts.fixture);
  return {
    name: 'nim',
    args: nimArgs(fixture),
    options: {cwd: dir}
  };
}

function transformBuffer(buffer, opts) {
  if (buffer.stderr) buffer.stderr = sanitizeStdErr(buffer.stderr, opts);
}

// Remove output from Nim
// Error: execution of an external program failed: '/home/codewarrior/fixture '
function sanitizeStdErr(stderr, opts) {
  const ss = stderr.split('\n');
  if (ss[0] == "Error: execution of an external program failed: '/home/codewarrior/fixture '") {
    return '';
  }
  return ss.join('\n');
}

function nimArgs(file) {
  return [
    'compile',
    '--run',            // run the compiled program
    '--define:release', // release build
    '--warnings:off',   // turn all warnings off
    '--hints:off',      // turn all hints off
    '--verbosity:0',    // set Nim's verbosity to minimal
    '--stackTrace:on',  // turn stack tracing on
    '--lineTrace:on',   // turn line tracing on
    '--checks:on',      // turn all runtime checks on
    file
  ];
}
