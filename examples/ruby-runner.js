"use strict";

const path = require('path');
const fs = require('fs-extra');
const _outputFileSync = (path, data) => (fs.outputFileSync(path, data), path);

async function solutionOnly(opts) {
  var code = opts.solution;
  if (opts.setup) {
    code = opts.setup + '\n' + code;
  }

  return {
    name: 'ruby',
    args: ['-e', code],
    options: {cwd: opts.dir}
  };
}

async function testIntegration(opts) {
  switch (opts.testFramework) {
    case 'cw':
    case 'cw-2':
      return useCw2(opts);
    case 'rspec':
      return useRSpec(opts);
    default:
      throw new Error(`Unsupported test framework: ${opts.testFramework}`);
  }
}


function modifyOpts(opts) {
  // if a github repo was provided, add the workspace to the load path so that requires work correctly
  if (opts.githubRepo || opts.files || opts.gist) {
    opts.setup = `$LOAD_PATH << '${opts.dir}'\n${opts.setup || ''}`;
  }
}

function sanitizeStdErr(error, opts) {
  return error.replace(/[\w/-]*(cw-2.rb):[\d]*:in( `(measure|wrap_error|it|describe)'<:LF:>)?/g, '')
              .replace(/-e:[\d]*:in/g, '')
              .replace('  ', ' ')
              .replace(/<:LF:> `(block in )?(<main>|describe|it)'/g, '')
              .replace('  ', ' ');
}

function sanitizeStdOut(stdout, opts) {
  return sanitizeStdErr(stdout, opts);
}

async function useCw2(opts) {
  const requireFramework = "require('/runner/frameworks/ruby/cw-2')";

  // by default cw-2 concatenates files so this special option causes separate files to be used instead
  if (opts.entryPath || opts.useSeparateFiles) {
    return {
      name: 'ruby',
      args: [prepareEntryFile(opts, requireFramework)],
      options: {cwd: opts.dir}
    };
  }

  const code = [
    requireFramework,
    opts.setup ? opts.setup : '',
    opts.solution,
    opts.fixture,
  ];
  return {
    name: 'ruby',
    args: ['-e', code.join('\n')],
    options: {cwd: opts.dir}
  };
}

async function useRSpec(opts) {
  return {
    name: 'rspec',
    args: [
      prepareEntryFile(opts),
      '--require', '/runner/frameworks/ruby/cwrspecformatter.rb',
      '--format', 'CwRSpecFormatter'
    ],
    options: {cwd: opts.dir}
  };
}

// used when a single file will be used as the entry point. It will include the other files separately
function prepareEntryFile(opts, require) {
  // if there is no require and an entryPath is provided than just use that file directly
  if (!require && opts.entryPath) return opts.entryPath;

  const entry = [
    "`rm -rf /workspace/entry.rb`",
    require || ''
  ];

  if (opts.entryPath) {
    entry.push(`require "${opts.entryPath}"`);
  }
  else {
    if (opts.setup) {
      entry.push(`require "${_outputFileSync(path.join(opts.dir, 'setup.rb'), opts.setup)}"`);
      // have the file remove itself from the file system after it is loaded, so that it cannot be read by users trying to solve
      entry.push("`rm -rf /workspace/setup.rb`");
    }
    entry.push(`require "${_outputFileSync(path.join(opts.dir, 'solution.rb'), opts.solution)}"`);
    if (opts.fixture)
      entry.push(`require "${_outputFileSync(path.join(opts.dir, 'spec.rb'), opts.fixture)}"`);
  }
  return _outputFileSync(path.join(opts.dir, 'entry.rb'), entry.join('\n'));
}
