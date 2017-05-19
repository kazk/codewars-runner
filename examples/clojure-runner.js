"use strict";

const uberJar = '/runner/jvm-runner/target/jvm-runner-0.1.3-standalone.jar';

async function solutionOnly(opts) {
  return {
    name: 'java',
    args: ['-jar', uberJar],
    stdin: JSON.stringify(opts)
  };
}

async function testIntegration(opts) {
  return {
    name: 'java',
    args: ['-jar', uberJar],
    stdin: JSON.stringify(opts)
  };
}

function transformBuffer(buffer, opts) {
  if (buffer.stdout) buffer.stdout = sanitizeStdOut(buffer.stdout, opts);
}
// HACK: don't know clojure well enough to fix issue within actual runner, but it is escaping line breaks when it shouldn't
function sanitizeStdOut(stdout, opts) {
  return stdout.replace(/\<:LF:\>\<PASSED::\>/g, '\n<PASSED::>')
               .replace(/\<:LF:\>\<FAILED::\>/g, '\n<FAILED::>')
               .replace(/\<:LF:\>\<ERROR::\>/g, '\n<ERROR::>');
}
