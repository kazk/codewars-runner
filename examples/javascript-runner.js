"use strict";

const path = require('path');
const exec = require('child_process').exec;
const fs = require('fs-extra');

// TODO Needs major refactoring. Possibly split into sub-runners based on target.
// TODO Start looking into dropping Node 0.10 support (End-of-Life 2016-10-31)
//
// Use `.babelrc` file
// https://babeljs.io/docs/plugins/preset-env/
// Mocha:
// - `npm install babel-register`
//   - `mocha --compilers js:babel-register`
// - `npm install babel-register babel-polyfill`
//   - `mocha --require babel-polyfill --compilers js:babel-register`
// Karma:
// - Use `karma.conf.js`
// - `npm install karma-babel-preprocessor`
//   - Karma loads `karma-*` modules automatically
// - `npm install karma-phantomjs-launcher`
//   - `karma start --browsers PhantomJS`

async function solutionOnly(opts) {
  const code = `${opts.setup ? opts.setup + ';\n' : ''}${opts.solution}`;
  return execNode(opts, code);
}

async function testIntegration(opts) {
  switch (opts.testFramework) {
    case 'cw': // for backwards compatibility, all legacy CW challenges have been updated to use cw-2
    case 'cw-2':
      return useCw2(opts);

    case 'mocha':
    case 'mocha_bdd':
      return useMocha(opts, 'bdd');

    case 'mocha_tdd':
      return useMocha(opts, 'tdd');

    case 'karma':
    case 'karma_bdd':
      return useKarma(opts, 'bdd');

    case 'karma_tdd':
      return useKarma(opts, 'tdd');

    default:
      throw new Error(`Unsupported test framework: ${opts.testFramework}`);
  }
}


function transformBuffer(buffer, opts) {
  if (buffer.stdout) buffer.stdout = sanitize(buffer.stdout, opts);
  if (buffer.stderr) buffer.stderr = sanitize(buffer.stderr, opts);
}

function sanitize(error, opts) {
  return error.replace(/(\()?\/codewars\/[(\w\/-\d.js:) ;]*/g, '')
              .replace(/( Object. )?[\(]?\[eval\][-:\w\d\)]* at/g, '')
              .replace(/Module._compile.*/g, '')
              .replace('Object.Test.handleError ', '')
              .replace('  ', ' ')
              .replace(opts.setup || '', '')
              .replace(opts.fixture || '', '');
}

// a files object/hash can be passed in as options, which will be transformed (if applicable) and then stored
// in the provided directory.
// write files that may have been included to the file system, within the directory that the code executes in
function files(opts) {
  for (const k of Object.keys(opts.files)) {
    const content = k.endsWith('.js') ? maybeTransform(opts.files[k], opts) : opts.files[k];
    fs.outputFileSync(path.join(opts.dir, k), content);
  }
}

// ---------------------------------

function useMocha(opts, interfaceType) {
  if (!opts.solution && opts.files)
    return runMocha(opts, interfaceType, opts.entryPath);

  const code = [
    `${opts.setup || ''};`,
    `${opts.solution};`,
    `(function() {`,
    `  ${opts.fixture};`,
    `})();`,
  ].join('\n');
  const solutionFile = path.join(opts.dir, 'fixture.js');
  fs.outputFileSync(solutionFile, maybeTransform(code, opts));
  return runMocha(opts, interfaceType, solutionFile);
}

function runMocha(opts, interfaceType, file) {
  // NOTE: Mocha based testing currently does not support Node versioning
  return {
    name: 'mocha',
    args: [
      '-t', opts.timeout,
      '-u', interfaceType,
      '-R', 'mocha-reporter',
      file
    ]
  };
}

function useKarma(opts, interfaceType) {
  var dir = opts.dir;
  // files to load into Karma
  var files = [];
  // handle includes
  if (opts.externalIncludes) {
    opts.externalIncludes.forEach(name => {
      files.push(...frontendFrameworks[name]);
    });
  }

  // handle core code (if there is any)
  ['setup', 'solution', 'fixture'].forEach(function(type) {
    if (opts[type]) {
      const file = path.join(dir, type + '.js');
      // always transform this code, it ends up in the browser:
      fs.outputFileSync(file, transform(opts[type], '0.10.x', type + '.js'));
      files.push(file);
    }
  });

  // include any additional files
  if (opts.files) {
    Object.keys(opts.files).forEach(file => {
      // make sure to include the entry file last
      if (file !== opts.entryFile && file.match(/\.(js|css|html)$/)) {
        files.push(`${opts.dir}/${file}`);
      }
    });
  }

  // now include the entry file
  if (opts.entryPath) {
    files.push(opts.entryPath);
  }

  const config = {
    files: files,
    singleRun: true,
    autoWatch: false,
    retryLimit: 0,
    frameworks: ['mocha', 'chai'],
    browsers: ['PhantomJS'],
    plugins: ['karma-*', '/runner/frameworks/javascript/karma-coderunner-reporter.js'],
    reporters: ['coderunner'],
    logLevel: 'warn',
    client: {
      mocha: {
        timeout: opts.timeout,
        ui: interfaceType,
      },
    },
  };

  const code = [
    `var KarmaServer = require('karma').Server;`,
    `var karma = new KarmaServer(${JSON.stringify(config, null, 4)}, function(code) {`,
    `  process.exit(code);`,
    `});`,
    `karma.start();`,
  ].join('\n');
  return execNode(opts, code);
}

function useCw2(opts) {
  var code;
  if (opts.projectMode) {
    code = [
      `require('/runner/frameworks/javascript/cw-2');`,
      `require('${opts.entryPath}');`,
    ].join('\n');
  }
  else {
    // generate random identifier to avoid name collision
    const GLOBAL = `GLOBAL_${Math.random().toString(36).substr(2,8)}`;
    // run tests inline to the context but within their own scope. Redefine the key test methods in case they were
    // locally redefined within the solution.
    code = [
      `require('/runner/frameworks/javascript/cw-2');`,
      `var assert = require('assert');`,
      `Test.handleError(function(){`,
      `  const ${GLOBAL} = global;`,
      `  ${opts.setup};`,
      `  ${opts.solution};`,
      `  (function() {`,
      `    if (global != ${GLOBAL}) throw new Error('global was reassigned');`,
      `    var Test = global.Test, describe = global.describe, it = global.it, before = global.before, after = global.after;`,
      `    ${opts.fixture};`,
      `  })();`,
      `});`,
    ].join('\n');
  }
  return execNode(opts, code);
}

// opts.requires ?
function execNode(opts, code, runCode, fail) {
  var version = versionInfo(opts);
  code = maybeTransform(code, opts);

  const args = ['-e', code, '--no-deprecation'];
  (opts.requires || []).forEach(function(f) {
    args.push("--require", f);
  });

  return {
    name: `/usr/local/n/versions/node/${version.node}/bin/node`,
    args: args,
    options: {
      cwd: opts.dir
    }
  };
}

function nodeVersion(version) {
  switch (version) {
    case "6.x":
      return "6.6.0";
    case "0.10.x":
      return "0.10.33";
    default:
      return version;
  }
}

// returns information about the version passed in, such as its node version and if babel is enabled
function versionInfo(opts) {
  const info = {
    name: (opts.languageVersion || '6.x').split('/')[0],
    babel: opts.languageVersion && opts.languageVersion.split('/')[1] == 'babel'
  };
  info.node = nodeVersion(info.name);
  return info;
}

// will babel transform the code if babel is configured, otherwise will just return the code unaltered.
function maybeTransform(code, opts, filename) {
  var version = versionInfo(opts);
  if (version.babel) return transform(code, version.name, filename);
  return code;
}

function transform(code, version, filename) {
  try {
    switch (version) {
      case '0.10.x':
        return require('babel-core').transform(code, {
          presets: ["stage-1", "react"],
          plugins: [
            "check-es2015-constants",
            "angular2-annotations",
            "transform-decorators-legacy",
            "transform-class-properties",
            "transform-flow-strip-types",
            "transform-es2015-arrow-functions",
            "transform-es2015-block-scoped-functions",
            "transform-es2015-block-scoping",
            "transform-es2015-classes",
            "transform-es2015-computed-properties",
            "transform-es2015-destructuring",
            "transform-es2015-duplicate-keys",
            "transform-es2015-for-of",
            "transform-es2015-function-name",
            "transform-es2015-literals",
            "transform-es2015-object-super",
            "transform-es2015-parameters",
            "transform-es2015-shorthand-properties",
            "transform-es2015-spread",
            "transform-es2015-sticky-regex",
            "transform-es2015-template-literals",
            "transform-es2015-typeof-symbol",
            "transform-es2015-unicode-regex",
            "transform-regenerator",
          ],
          ast: false,
          filename: filename || 'kata.js'
        }).code;

      default:
        return require('babel-core').transform(code, {
          presets: ["stage-1", "node5", "react"],
          plugins: [
            "angular2-annotations",
            "transform-decorators-legacy",
            "transform-class-properties",
            "transform-flow-strip-types",
          ],
          ast: false,
          filename: filename || 'kata.js'
        }).code;
    }
  }
  catch (ex) {
    // var msg = ex.message;
    // if (ex.loc) {
    //     // replace the line number since it is not what the user sees
    //     msg = msg.replace(/ \(\d*:\d*\)/, ":" + ex.loc.column)
    //     var lines = code.split('\n');
    //     msg += "\n" + lines[ex.loc.line - 1];
    //     msg += "\n";
    //     for(var i = 1;i < ex.loc.column; i++) {
    //         msg += ' ';
    //     }
    //     msg += '^';
    // }
    throw new Error(ex.message);
  }
}


const frontendFrameworks = {
  'angular@1.2': [
    '/runner/frameworks/javascript/angular/1.2.9/angular.js',
    '/runner/frameworks/javascript/angular/1.2.9/angular-{mocks,resource,route,sanitize}.js',
  ],
  'angular@1.3': [
    '/runner/frameworks/javascript/angular/1.3.9/angular.js',
    '/runner/frameworks/javascript/angular/1.3.9/angular-{mocks,resource,route,sanitize}.js',
  ],
  'angular@1.4': [
    '/runner/frameworks/javascript/angular/1.4.9/angular.js',
    '/runner/frameworks/javascript/angular/1.4.9/angular-{mocks,resource,route,sanitize}.js',
  ],
  'angular@1.5': [
    '/runner/frameworks/javascript/angular/1.5.8/angular.js',
    '/runner/frameworks/javascript/angular/1.5.8/angular-{mocks,resource,route,sanitize}.js',
  ],
};
