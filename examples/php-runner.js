"use strict";

const path = require("path");
const fs = require('fs-extra');

async function solutionOnly(opts) {
  return {
    name: 'php',
    args: ['-r', `${opts.setup ? opts.setup + ';\n' : ''}${opts.solution}`]
  };
}

async function testIntegration(opts) {
  switch (opts.testFramework) {
    case 'cw-2':
      return useCw2(opts);

    case 'phpunit':
      return usePHPUnit(opts);

    default:
      throw new Error(`Unsupported test framework: ${opts.testFramework}`);
  }
}

function transformBuffer(buffer, opts) {
  if (buffer.stdout) buffer.stdout = sanitizeStdOut(buffer.stdout, opts);
  if (buffer.stderr) buffer.stderr = sanitizeStdErr(buffer.stderr, opts);
}

function sanitizeStdOut(output, opts) {
  return output.split('\n')
               .filter(s => blacklist.every(re => !re.test(s)))
               .map(s => /\/tmp.*\.php/.test(s) ? s.replace(/\/tmp\/[^\/]+\//, '') : s)
               .join('\n');
}

function sanitizeStdErr(error, opts) {
  return ('\n' + error).replace(/(Uncaught Exception: Failed Test).*/g, '$1')
                       .replace(/\/runner\/.*\.php/g, 'input');
}

async function useCw2(opts) {
  const code = [
    `require_once('frameworks/php/cw-2.php');`,
    `${opts.setup || ''}`,
    `${opts.solution}`,
    `$test = new Test;`,
    `${opts.fixture}`,
  ].join('\n');
  return {
    name: 'php',
    args: ['-r', code]
  };
}

async function usePHPUnit(opts) {
  const code = [
    `<?php`,
    `    use phpunit\\framework\\TestCase;`,
    `    ${opts.setup || ''}`,
    `    ${opts.solution}`,
    `    ${opts.fixture}`,
    `?>`,
  ].join('\n');

  const file = path.join(opts.dir, 'run.php');
  await fs.outputFile(file, code);
  return {
    name: 'phpunit',
    args: ['--configuration=frameworks/php/phpunit/phpunit.xml', file]
  };
}

const blacklist = [
  /^\s*$/,
  /^ *PHPUnit 5\.\d\.\d* by Sebastian Bergmann and contributors\./,
  /\s+\d \/ \d \(\d+\%\)/,
  /^Time: \d+ ms, Memory:/,
  /^There was \d+ failure/,
  /^FAILURES!$/,
  /^Tests: \d+, Assertions:/,
];
