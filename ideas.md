```javascript
module.exports = createRunner({
  solutionOnly,
  testIntegration,
});

// resolves with arguments for runCode
async function solutionOnly(opts) {
  const solution = path.join(opts.dir, 'solution.lua');
  await fs.outputFile(solution, opts.solution);
  return {
    name: 'lua',
    args: [solution],
    options: {cwd: opts.dir}
  };
}

async function testIntegration(opts) {
  const fixture = path.join(opts.dir, 'fixture.lua');
  await fs.outputFile(path.join(opts.dir, 'solution.lua'), opts.solution);
  await fs.outputFile(fixture, opts.fixture);
  return {
    name: 'busted',
    args: [
      fixture,
      `--output=/runner/lua/codewars.lua`,
    ],
    options: {cwd: opts.dir}
  };
}
```



```javascript
const exec = require('child_process').exec;

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const executable = path.join(opts.dir, 'solution');
    const solutionFile = path.join(opts.dir, 'solution.c');
    fs.outputFileSync(solutionFile, opts.solution);
    const args = ['clang-3.6', '-std=c11', solutionFile, '-o', executable, '-lm'];
    if (opts.setup) {
      const setupFile = path.join(opts.dir, 'setup.c');
      fs.outputFileSync(setupFile, opts.setup);
      args.push(setupFile);
    }

    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      opts.publish('stdout', stdout);
      resolve({name: executable, args: []});
    });
  });
}

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    const executable = path.join(opts.dir, 'solution');
    const solutionFile = path.join(opt.dir, 'solution.c');
    const fixtureFile = path.join(opts.dir, opts.fixture);

    fs.outputFileSync(solutionFile, opts.solution);
    fs.outputFileSync(fixtureFile, opts.fixture);
    const args = [
      'clang-3.6',
      '-std=c11',
      fixtureFile, solutionFile,
      '-o', executable,
      './frameworks/c/criterion.c',
      '-I./frameworks/c',
      '-lcriterion',
      '-lm'
    ];
    if (opts.setup) {
      const setupFile = path.join(opts.dir, 'setup.c');
      fs.outputFileSync(setupFile, opts.setup);
      args.push(setupFile);
    }
    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      opts.publish('stdout', stdout);
      resolve({name: executable, args: ['-q', '-j1']});
    });
  });
}
```





```javascript
// current
// exposing `opts` here like this is error-prone as seen with C++ issue #402
module.exports = function run(opts, cb) {
  shovel.start(opts, cb, {
    solutionOnly(runCode, fail) {
    },
    testIntegration(runCode, fail) {
    }
  });
};

// promisified
module.exports = createRunner({
  solutionOnly(opts) {
    return new Promise((resolve, reject) => {
      // setup files
      // try compile
      // if failed, reject with error + stdout,stderr
      // otherwise, resolve with parameters for runCode(param);
    });
  },
  testIntegration(opts) {
    return new Promise((resolve, reject) => {
    });
  },
});

// this will be provided by codewars-runner package
function createRunner(strategies) {
  return function(opts) {
    return new Promise((resolve, reject) => {
      // process options
      // do various setup
      // run
      // report
    });
  };
}

// usage
try {
  return runCode(await strategies[opts.strategy](opts));
} catch (err) { // compile error
  return handleError(err);
}
```
