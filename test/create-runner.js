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
      'start.sh', // echo "test" => "test.txt"
      'test.txt', // test =
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

  it('should support strategies.files(opts)', async function() {
    const run = runner.createRunner({
      async files(opts) {
        const fs = require('fs-extra');
        return Promise.all(Object.keys(opts.files).map(p => fs.outputFile(`${opts.dir}/${p}`, opts.files[p] + 'bar\n')));
      },
      async solutionOnly(opts) {
        return {
          name: 'cat',
          args: ['./file.txt'],
          options: {
            cwd: '/home/codewarrior'
          }
        };
      }
    });
    const buffer = await run({
      solution: '#',
      files: {
        'file.txt': 'foo',
      }
    });
    expect(buffer.stdout).to.equal('foobar\n');
  });

  it('should handle timeout', async function() {
    const run = runner.createRunner({
      async solutionOnly(opts) {
        return {
          name: 'sleep',
          args: ['2'],
          options: {
            cwd: '/home/codewarrior'
          }
        };
      }
    });
    const buffer = await run({
      timeout: 1000,
      solution: '#',
    });
    expect(buffer.stdout).to.equal('');
    expect(buffer.stderr).to.equal('Process was terminated. It took longer than 1000ms to complete.\n');
    expect(buffer.status).to.equal('max_time_reached');
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
    expect(buffer.stderr).to.equal('message in stderr');
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
    expect(buffer.stderr).to.equal('message in stderr');
    expect(buffer.compilationFailure).to.be.true;
  });

  // TODO Test for multibyte characters
});
