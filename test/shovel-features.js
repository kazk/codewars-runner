"use strict";

const expect = require('chai').expect;
const runner = require('../');
const shovel = runner.shovel;

describe('shovel', function() {
  it('start', async function() {
    const buffer = await shovel.start({
      code: '#'
    }, {
      solutionOnly(runCode) {
        runCode({
          name: 'echo',
          args: ['hello world']
        });
      }
    });
    expect(buffer.stdout).to.equal('hello world\n');
  });

  it('should support githubRepo downloading', async function() {
    const buffer = await shovel.start({
      code: '#',
      githubRepo: 'jhoffner/test',
      dir: '/home/codewarrior'
    }, {
      solutionOnly(runCode) {
        runCode({
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        });
      }
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
    const buffer = await shovel.start({
      code: '#',
      setup: '# @config: gist 3acc7b81436ffe4ad20800e242ccaff6',
      dir: '/home/codewarrior'
    }, {
      solutionOnly(runCode) {
        runCode({
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        });
      }
    });
    expect(buffer.stdout).to.equal([
      'gist.js',
      'solution.txt',
      ''
    ].join('\n'));
  });

  it('should support config bash-file', async function() {
    const buffer = await shovel.start({
      code: '#',
      setup: [
        '# @config: github-repo jhoffner/test',
        '# @config: bash-file start.sh',
      ].join('\n'),
    }, {
      solutionOnly(runCode) {
        runCode({
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        });
      }
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
    const buffer = await shovel.start({
      code: '#',
      files: {
        'myconfig.rb': 'puts 123'
      }
    }, {
      solutionOnly(runCode) {
        runCode({
          name: 'ls',
          options: {
            cwd: '/home/codewarrior'
          }
        });
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
        rs.stdout.on('data', (data) => {
          if (data && data.includes('Running')) resolve();
        });
        rs.on('error', reject);
        setTimeout(() => reject('timeout'), 2000);
      }).catch(err => {
        console.log(err);
      });
    }

    const buffer = await shovel.start({
      code: '#',
      services: ['redis']
    }, {
      startService(service, opts) {
        if (service == 'redis') return startRedis(opts);
        return Promise.resolve();
      },
      solutionOnly(runCode) {
        runCode({
          name: 'redis-cli',
          args: ['set', 'foo', '100'],
          options: {
            cwd: '/home/codewarrior'
          }
        });
      }
    });
    expect(buffer.stdout).to.equal('OK\n');
  });
});
