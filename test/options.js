
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

  describe('opts.code', function() {
    it('is an alias of .solution', function() {
      const opts = processOptions({code: 'code'});
      expect(opts.solution).to.equal('code');
    });
  });


  describe('opts.entryFile from pattern', function() {
    it('should set "index.js" given pattern "index.*"', function() {
      const opts = processOptions({
        entryFile: 'index.*',
        files: {
          'index.js': '',
          'module.js': '',
          'util.js': '',
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
            'index.js': '',
            [`${k}.js`]: '',
            'util.js': '',
          }
        });
        expect(opts.entryFile).to.equal(`${k}.js`);
      });
    }
  });
});
