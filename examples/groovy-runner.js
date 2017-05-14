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
