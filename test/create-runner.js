"use strict";

const expect = require('chai').expect;
const runner = require('../');

describe('createRunner', function() {
  it('echo', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'echo',
          args: ['hello world']
        };
      }
    });
    const buffer = await run({code: '#'});
    expect(buffer.stdout).to.equal('hello world\n');
  });

  it('should support githubRepo downloading', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        };
      },
    });
    const buffer = await run({
      code: '#',
      githubRepo: 'jhoffner/test',
      dir: '/home/codewarrior'
    });
    expect(buffer.stdout).to.equal([
      'LICENSE',
      'sample.js',
      'sample.rb',
      'solution.txt',
      'start.sh',
      ''
    ].join('\n'));
  });

  it('should support gist downloading', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        };
      },
    });
    const buffer = await run({
      code: '#',
      setup: '# @config: gist 3acc7b81436ffe4ad20800e242ccaff6',
      dir: '/home/codewarrior'
    });
    expect(buffer.stdout).to.equal([
      'gist.js',
      'solution.txt',
      ''
    ].join('\n'));
  });

  it('should support config bash-file', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        };
      },
    });
    const buffer = await run({
      code: '#',
      setup: [
        '# @config: github-repo jhoffner/test',
        '# @config: bash-file start.sh',
      ].join('\n'),
    });
    expect(buffer.stdout).to.equal([
      'LICENSE',
      'sample.js',
      'sample.rb',
      'solution.txt',
      'start.sh',
      'test.txt',
      ''
    ].join('\n'));
  });

  it('should support additional files', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        };
      },
    });
    const buffer = await run({
      code: '#',
      files: {
        'myconfig.rb': 'puts 123'
      }
    });
    expect(buffer.stdout).to.equal([
      'myconfig.rb',
      'solution.txt',
      ''
    ].join('\n'));
  });

  it('should support services', async function() {
    const cp = require('child_process');
    function startRedis(opts) {
      return new Promise((resolve, reject) => {
        opts.publish('status', 'Starting redis-server');
        const rs = cp.spawn('redis-server', ['--dir', opts.dir]);
        rs.stdout.setEncoding('utf8');
        rs.stdout.on('data', (data) => {
          if (data && data.includes('Running')) resolve();
        });
        rs.on('error', reject);
        setTimeout(() => reject('timeout'), 2000);
      }).catch(err => {
        console.log(err);
      });
    }

    const run = runner.createRunner({
      startService(service, opts) {
        if (service == 'redis') return startRedis(opts);
        return Promise.resolve();
      },
      async solutionOnly(opts) {
        return {
          name: 'redis-cli',
          args: ['set', 'foo', '100'],
          options: {
            cwd: '/home/codewarrior'
          }
        };
      },
    });

    const buffer = await run({
      code: '#',
      services: ['redis']
    });
    expect(buffer.stdout).to.equal('OK\n');
  });

  it('should handle .compilationFailure for solutionOnly', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        throw new Error('message in stderr');
      }
    });
    const buffer = await run({code: '#'});
    expect(buffer.stdout).to.equal('');
    expect(buffer.stderr).to.equal('message in stderr\n');
    expect(buffer.compilationFailure).to.be.true;
  });
  it('should handle .compilationFailure for testIntegration', async function() {
    const run = runner.createRunner({
      async testIntegration(opts) {
        throw new Error('message in stderr');
      }
    });
    const buffer = await run({solution: '#', fixture: '#'});
    expect(buffer.stdout).to.equal('');
    expect(buffer.stderr).to.equal('message in stderr\n');
    expect(buffer.compilationFailure).to.be.true;
  });

  it.skip('should be able to handle large output data', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'node',
          args: ['/workspace/solution.txt']
        };
      }
    });
    const buffer = await run({
      code: `for (let i = 0; i < 9999; ++i) console.log(i * 10);`
    });
    expect(buffer.stderr).to.equal('');
    expect(buffer.stdout).to.equal(Array.from({length: 9999}, (_, i) => i*10).join('\n') + '\n');
  });

  // TODO Test for single stdout write containing large output (> 65536 bytes) with multibyte characters
});
