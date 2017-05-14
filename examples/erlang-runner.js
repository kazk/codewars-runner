"use strict";

const path = require('path');
const fs = require('fs-extra');

async function solutionOnly(opts) {
  const setup = opts.setup ? compileFileSync(opts.setup, opts.dir) : '';
  return {
    name: 'erl',
    args: [
      '-pz', opts.dir,
      '-noshell',
      '-eval', setup + opts.solution,
    ],
    options: {
      env: {
        HOME: process.env['HOME'],
        ERL_CRASH_DUMP: "/dev/null"
      }
    }
  };
}

async function testIntegration(opts) {
  const setup = opts.setup ? compileFileSync(opts.setup, opts.dir) : '';
  const solutionFileName = getFileName(opts.solution, 'solution.erl');
  fs.outputFileSync(solutionFileName, opts.solution);
  const solutionModuleName = moduleName(solutionFileName);
  const testFixture = compileFileSync([
    '-module(' + solutionModuleName + '_tests).',
    '-compile(export_all).',
    '-include_lib("eunit/include/eunit.hrl").',
    opts.fixture
  ].join('\n'), opts.dir);

  return {
    name: 'erl',
    args: [
      '-pz', opts.dir,
      '-noshell',
      '-eval',
      [
        setup,
        erlangCompileCommand(solutionFileName, opts.dir),
        testFixture,
        'eunit:test(', solutionModuleName, '), init:stop().'
      ].join('\n')
    ],
    options: {
      env: {
        HOME: process.env['HOME'],
        ERL_CRASH_DUMP: "/dev/null"
      }
    }
  };
}

function getFileName(code, fallback) {
  const m = /-module\(([a-zA-Z][a-zA-Z\d_]*)\)/.exec(code);
  if (m !== null) return m[1] + '.erl';
  return fallback;
}

function moduleName(fileName) {
  return path.basename(fileName).replace(/\.[^/.]+$/, "");
}

function erlangCompileCommand(fileName, dir) {
  return `compile:file("${fileName}", {outdir, "${dir}"}),`;
}

function compileFileSync(code, erlangCodeDir) {
  const file = path.join(erlangCodeDir, getFileName(code));
  fs.outputFileSync(file, code);
  return erlangCompileCommand(file, erlangCodeDir);
}
