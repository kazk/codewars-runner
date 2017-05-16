"use strict";

const path = require('path');
const exec = require('child_process').exec;
const fs = require('fs-extra');

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const executable = path.join(opts.dir, 'solution');
    const solutionFile = path.join(opts.dir, 'solution.m');
    fs.outputFileSync(solutionFile, getCode(opts));
    exec(compileArgs(['-o', executable, solutionFile], opts).join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      opts.publish('stdout', stdout);
      resolve({
        name: executable,
        args: []
      });
    });
  });
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    if (opts.testFramework != 'unitkit')
      return reject(new Error(`Unsupported test framework: ${opts.testFramework}`));

    const executable = path.join(opts.dir, 'solution');
    exec(compileArgs(['-o', executable, ...prepareUnitKit(opts)], opts), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      opts.publish('stdout', stdout + stderr);
      resolve({
        name: executable,
        args: []
      });
    });
  });
}

// objc NSLog is the stanard way of debugging, but everything goes to stderr. Fortunately normal
// log messages also contain a timestamp prefix, so we can identify these messages and move them to stdout.
// The one main issue here is that if anything is written to stdout, it won't be interleaved together.
function transformBuffer(buffer, opts) {
  let stderr = buffer.stderr;
  buffer.stderr = '';
  stderr.split(/\n/gm).forEach(line => {
    let newLine = line.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3,4} \w*\[[\d:\w]*\]  ?/, ''); // eslint-disable-line no-regex-spaces
    //remove UnitKit output
    newLine = newLine.replace(/=== \[[\w \d]*\] ===/, '');
    //remove StackTrace
    newLine = newLine.replace(/Stack trace: \(.*\)/, '');
    if (line == newLine) buffer.stderr += line + "\n";
    else if (newLine) buffer.stdout += newLine + "\n";
  });

  // if there is nothing but empty lines, clear the stderr
  if (buffer.stderr.replace(/[ \n]/g, '') == '') {
    buffer.stderr = '';
  }
  if (buffer.stderr) buffer.stderr = sanitizeStdErr(buffer.stderr, opts);
}

function sanitizeStdErr(error, opts) {
  return error.replace(/clang.*gnustep-config.*--base-libs.\t*/g, '')
              .replace(/Error: Command failed:/g, '')
              .replace(/\/home.*(solution\.m|solution)[:0-9]*/g, '')
              .replace(/\/home.*(fixture\.m|fixture)[:0-9]*/g, '')
              .replace('\n', '')
              .replace('  ', ' ')
              .replace(opts.setup || '', '')
              .replace(opts.fixture || '', '');
}

function compileArgs(args, opts) {
  switch (opts.languageVersion) {
    case 'objc-arc':
      args.unshift('clang', '-fobjc-arc', '`gnustep-config --objc-flags --objc-libs`');
      break;

    case 'noobjc-arc':
    default:
      args.unshift('clang', '`gnustep-config --objc-flags --objc-libs`');
      break;
  }
  args.push('`gnustep-config --base-libs`');
  return args;
}

function prepareUnitKit(opts) {
  const fixtureHeader = [
    `#import <Foundation/Foundation.h>`,
    `#import <UnitKit/UnitKit.h>`,
    ``,
    `@interface TestSuite : NSObject <UKTest>`,
    `@end`,
  ].join('\n');

  const fixture = [
    `${opts.setup ? '#import "setup.m"' : ''}`,
    `#import "solution.m"`,
    `${fixtureHeader}`,
    `${opts.fixture}`,
  ].join('\n');

  const main = [
    `${fixtureHeader}`,
    ``,
    `#import <Foundation/Foundation.h>`,
    `// our custom runner`,
    `#import <UnitKit/CWRunner.h>`,
    ``,
    `#ifndef __has_feature`,
    `  #define __has_feature(x) 0  // Compatibility with non-clang compilers.`,
    `#endif`,
    `#ifndef __has_extension`,
    `  #define __has_extension __has_feature // Compatibility with pre-3.0 compilers.`,
    `#endif`,
    ``,
    `int main (int argc, const char *argv[])`,
    `{`,
    `    int status = EXIT_FAILURE;`,
    `    @autoreleasepool`,
    `    {`,
    `        TestSuite *testSuite = [TestSuite new];`,
    `        CWRunner* testReporter = [CWRunner new];`,
    `        [testReporter runSuite: [testSuite class]];`,
    ``,
    `        int testsFailed = [testReporter testsFailed];`,
    `        int exceptionsReported = [testReporter exceptionsReported];`,
    `        status = (testsFailed == 0 && exceptionsReported == 0 ? 0 : -1);`,
    ``,
    `        #if !__has_feature(objc_arc)`,
    `            // Manual memory management`,
    `            [testReporter release];`,
    `            [testSuite release];`,
    `        #else`,
    `            // ARC enabled, do nothing...`,
    `        #endif`,
    `    }`,
    `    return status;`,
    `}`,
  ].join('\n');
  const solutionFile = path.join(opts.dir, 'solution.m');
  fs.outputFileSync(solutionFile, getCode(opts));
  if (opts.setup) fs.writeFileSync(path.join(opts.dir, 'setup.m'), opts.setup);

  const fixtureFile = path.join(opts.dir, 'fixture.m');
  const mainFile = path.join(opts.dir, 'main.m');
  fs.outputFileSync(fixtureFile, fixture);
  fs.outputFileSync(mainFile, main);
  return [mainFile, fixtureFile, '-lUnitKit'];
}


function getCode(opts) {
  if (opts.mode === "default") { // ?
    return [
      `#import <Foundation/Foundation.h>`,
      `int main (int argc, const char *argv[]) {`,
      `   @autoreleasepool {`,
      `       ${opts.solution}`,
      `   }`,
      `   return 0;`,
      `}`
    ].join('\n');
  }

  return [
    `/* headers */`,
    `// setup`,
    `${opts.setupHeader || ''}`, // ?
    `// solution`,
    `${opts.codeHeader || ''}`, // ?
    `/* code */`,
    `// setup`,
    `${opts.setup || ''}`,
    `// solution`,
    `${opts.solution || ''}`,
  ].join('\n');
}
