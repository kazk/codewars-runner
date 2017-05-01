"use strict";

const expect = require('chai').expect;
const processOptions = require('../lib/process-options');

describe('processOptions(opts)', function() {
  describe('opts.dir', function() {
    it('should be set to /home/codewarrior by default', function() {
      const opts = processOptions({});
      expect(opts.dir).to.equal('/home/codewarrior');
    });
    it('should not be modified if set', function() {
      const opts = processOptions({dir: '/home/codewarrior2'});
      expect(opts.dir).to.equal('/home/codewarrior2');
    });
  });

  describe('opts.code', function() {
    it('is an alias of .solution', function() {
      const opts = processOptions({code: 'code'});
      expect(opts.solution).to.equal('code');
    });
  });

  describe('opts.files', function() {
    it('should be set to null if empty', function() {
      const opts = processOptions({files: {}});
      expect(opts.files).to.be.null;
    });
  });

  describe('opts.files[".runner/config.json"]', function() {
    it('should be used as defaults', function() {
      const opts = processOptions({
        files: {
          '.runner/config.json': JSON.stringify({
            dir: '/home/codewarrior2'
          }),
        }
      });
      expect(opts.dir).to.equal('/home/codewarrior2');
    });
  });

  describe('opts.files[".runner/setup.sh"]', function() {
    it('should be set as .bashFile', function() {
      const opts = processOptions({
        files: {
          '.runner/setup.sh': 'setup',
        }
      });
      expect(opts.bashFile).to.equal('.runner/setup.sh');
    });
  });

  describe('opts.projectMode', function() {
    it('should be true if .files are present without .solution', function() {
      const opts = processOptions({files: {'index.js': 'console.log(42);'}});
      expect(opts.projectMode).to.be.true;
    });

    it('should be false if .files is empty', function() {
      const opts = processOptions({files: {}});
      expect(opts.projectMode).to.be.false;
    });
    it('should be false if .solution is set', function() {
      const opts = processOptions({
        files: {'helper.js': 'module.exports = x => x;'},
        solution: 'require("./helper")(1);'
      });
      expect(opts.projectMode).to.be.false;
    });
  });

  describe('opts.entryFile from pattern', function() {
    it('should be set to "index.js" for pattern "index.*"', function() {
      const opts = processOptions({
        entryFile: 'index.*',
        files: {
          'index.js': '//',
          'module.js': '//',
          'util.js': '//',
        }
      });
      expect(opts.entryFile).to.equal('index.js');
    });
  });

  describe('opts.entryFile from known patterns', function() {
    for (const k of ['spec', 'test', 'fixture', 'entry']) {
      it(`should detect ${k}`, function() {
        const opts = processOptions({
          files: {
            'index.js': '//',
            [`${k}.js`]: '//',
            'util.js': '//',
          }
        });
        expect(opts.entryFile).to.equal(`${k}.js`);
      });
    }
  });

  describe('opts.filePaths', function() {
    it('should be setup for .projectMode for convenience', function() {
      const opts = processOptions({
        files: {
          'index.js': 'console.log(42);',
          'util.js': 'module.exports = x => x;',
        }
      });
      expect(opts.projectMode).to.be.true;
      expect(opts.filePaths).to.deep.equal([
        '/home/codewarrior/index.js',
        '/home/codewarrior/util.js',
      ]);
    });
  });

  describe('opts.strategy', function() {
    it('should be "testIntegration" when .fixture is present', function() {
      const opts = processOptions({
        solution: 'const f = x => x;',
        fixture:  'Test.assertEquals(f(1), 1);',
      });
      expect(opts.projectMode).to.be.false;
      expect(opts.strategy).to.equal('testIntegration');
    });

    it('should be "testIntegration" in .projectMode', function() {
      const opts = processOptions({
        files: {
          'solution.js': 'module.exports = x => x;',
          'fixture.js': 'Test.assertEquals(require("./solution")(1), 1);',
        },
      });
      expect(opts.projectMode).to.be.true;
      expect(opts.strategy).to.equal('testIntegration');
    });

    it('should be "solutionOnly" otherwise', function() {
      const opts = processOptions({
        solution: 'const f = x => x;'
      });
      expect(opts.projectMode).to.be.false;
      expect(opts.strategy).to.equal('solutionOnly');
    });
  });

  describe('config statments', function() {
    // TODO: tests for leading whitespaces
    // TODO: tests for multiple spaces in between
    const comments = [
      '//',
      '#',
      '--',
    ];
    const tests = [
      {s: '@config: github-repo {user}/{project}', k: 'githubRepo', v: 'user/project'},
      {s: '@config: github-repo {user}/{project}/tarball/{branch}', k: 'githubRepo', v: 'user/project/tarball/branch'},
      {s: '@config: gist {gistID}', k: 'gist', v: 'gistID'},
      {s: '@config: bash-file {fileName}', k: 'bashFile', v: 'fileName'},
      {s: '@config: bash {command}', k: 'bash', v: 'command'},
      {s: '@config: solution-path {path}', k: 'solutionPath', v: 'path'},
      {s: '@config: services {s1,s2}', k: 'services', v: ['s1','s2']},
    ];
    for (const c of comments) for (const t of tests) {
      it(`${c} ${t.s}`, function() {
        const opts = processOptions({
          setup: `${c} ${t.s.replace(/[{}]/g, '')}`,
        });
        expect(opts[t.k]).to.deep.equal(t.v);
      });
    }

    // JavaScript, Karma only
    it('// @config: include-external {external}', function() {
      const opts = processOptions({
        setup: '// @config: include-external angular@1.2',
      });
      expect(opts.externalIncludes).to.deep.equal(['angular@1.2']);
    });
    it('// @include-external {external}', function() {
      const opts = processOptions({
        setup: '// @include-external angular@1.2',
      });
      expect(opts.externalIncludes).to.deep.equal(['angular@1.2']);
    });

    // SQL only;
    it.skip('# @config: use-database {dbName}', function() {
    });
    it.skip('# @use-database {dbName}', function() {
    });

    // not documented
    // mentioned in csharp.js
    // https://github.com/Codewars/codewars-runner-cli/blob/815480438a336443327e850a2c9e51eaae8e4989/lib/runners/csharp.js#L66
    it.skip('@config: reference {ref}', function() {
    });
    it.skip('@reference {ref}', function() {
    });
  });
});
