"use strict";

module.exports = function processOptions(opts) {
  // if a specific config file was uploaded, then use that as well
  // we want to use it as the defaults though, any specific options passed in will override the config file
  if (opts.files && opts.files['.runner/config.json'])
    Object.assign(opts, JSON.parse(opts.files['.runner/config.json']));

  // set the default directory to run everything out of
  if (!opts.dir) opts.dir = '/home/codewarrior';
  // opts.code is an alias for opts.solution
  if (opts.code) opts.solution = opts.code;
  // in case anything needs to cleanup after itself
  if (!Array.isArray(opts.onCompleted)) opts.onCompleted = [];
  if (!opts.timeout) opts.timeout = 12000;

  assignProjectMode(opts);
  if (opts.projectMode)
    setupProjectMode(opts);

  opts.publish = function() {};
  if (opts.ably && opts.channel)
    setupAbly(opts);

  if (!opts.bashFile && opts.files && opts.files['.runner/setup.sh'])
    opts.bashFile = '.runner/setup.sh';

  if (opts.setup != null)
    applyConfigStatements(opts);
  if (!Array.isArray(opts.services)) opts.services = [];

  if (!opts.strategy)
    opts.strategy = (opts.projectMode || opts.fixture) ? 'testIntegration' : 'solutionOnly';
  return opts;
};

// project mode is when multiple files have been provided and not a solution value, which indicates
// that an entry file is to be specified and that the format is determined by the configuration.
function assignProjectMode(opts) {
  // if empty files were passed in, make the value null to make it easier to check for emptyness
  if (opts.files && Object.keys(opts.files).length === 0) opts.files = null;

  // indicate if we should process the files. If a solution is provided, then we assume the files are just there
  // as extra content, if no solution is provided, then one of the files will be treated as the entry file.
  opts.projectMode = Boolean(!opts.solution && opts.files);
}

// determines the file to be used as the entry file when project mode is enabled
function setupProjectMode(opts) {
  // if there is an entry file lets see if we need to convert it from a wildcard
  if (opts.entryFile && opts.entryFile.includes('*'))
    opts.entryFile = findWildcardFile(opts, opts.entryFile);

  // if no entry file was specified (or was not found using the wildcard above)
  if (!opts.entryFile) {
    const re = /(?:spec|test|fixture|entry)\..*/;
    opts.entryFile = Object.keys(opts.files).find(k => re.test(k));
  }

  if (opts.entryFile) opts.entryPath = `${opts.dir}/${opts.entryFile}`;

  // setup file paths so its easier to include them
  opts.filePaths = Object.keys(opts.files).map(name => `${opts.dir}/${name}`);
  opts.filteredFilePaths = function(ext) {
    const re = new RegExp(`\.${ext}$`);
    return opts.filePaths.filter(p => re.test(p));
  };
}

function findWildcardFile(opts, search) {
  for (const fileName of Object.keys(opts.files)) {
    if (wildcardMatch(fileName, search)) return fileName;
  }
}

function wildcardMatch(str, search) {
  if (!str) return false;
  return new RegExp(search.replace(/\./g, '\\.').replace(/\*/g, '.*')).test(str);
}

function setupAbly(opts) {
  try {
    const ably = new require('ably').Rest({log: {level: 0}});
    const channel = ably.channels.get(opts.channel);
    opts.publish = function(event, data) {
      if (event && data) channel.publish(event, data);
    };
  }
  catch (e) {} // eslint-disable-line no-empty
}

// we allow configuration to be applied via the setup code block. This is useful for requests in non-project mode.
// project mode configuration would normally be done instead via adding a .runner/config.json file.
function applyConfigStatements(opts) {
  for (const s of opts.setup.split('\n')) {
    let m = s.match(AT1);
    if (m === null) m = s.match(AT2);
    if (m === null) continue;
    switch (m[1]) {
      case 'github-repo':
      case 'gist':
      case 'bash':
      case 'bash-file':
      case 'solution-path':
      case 'use-database':
        opts[toCamel(m[1])] = m[2];
        break;
      case 'services':
        opts.services = m[2].split(/\s*,\s*/);
        break;
      case 'include-external':
        if (!Array.isArray(opts.externalIncludes)) opts.externalIncludes = [];
        opts.externalIncludes.push(m[2]);
        break;
      case 'reference':
        if (!Array.isArray(opts.references)) opts.references = [];
        opts.references.push(m[2]);
        break;
    }
  }
  return opts;
}

const toCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const AT1 = new RegExp([
  '^\\s*',
  '(?:#|\\/\\/|--).*',
  '\\s+',
  '@config:',
  '\\s+',
  '(',
  [
    'github-repo',
    'gist',
    'bash',
    'bash-file',
    'solution-path',
    'services',
    'use-database'
  ].join('|'),
  ')',
  '\\s+',
  '(.*)$',
].join(''));

const AT2 = new RegExp([
  '^\\s*',
  '(?:#|\\/\\/|--).*',
  '\\s+',
  '@(?:config:\\s+)?',
  '(',
  [
    'include-external',
    'reference',
    'use-database'
  ].join('|'),
  ')',
  '\\s+',
  '(\\S+)',
].join(''));

// @config: github-repo {user}/{project}
// @config: github-repo {user}/{project}/tarball/{branch}
//   download github repo
//
// @config: gist {gistID}
//   download gist with gistID
//
// @config: bash-file {filename}
//   override any default config settings for a script to run
//
// @config: bash {command}
//   override any default config settings for a script to run
//
// @config: solution-path {path}
//   indcates to some languages what the solution file should be called
//
// @config: services {serviceNames}
//   indcates which services should be enabled. commas seperated (ie: mongodb,redis)
//   csv: true
//
// @config: use-database {dbName}
//   SQL only; PostgreSQL only; only dvdrental
//   > both @use-database and @config: use-database are supported for backwards compatibility
//   > https://github.com/Codewars/codewars-runner-cli/blob/815480438a336443327e850a2c9e51eaae8e4989/lib/runners/sql.js#L64
//
// @config: include-external angular@1.[2-5]
// @include-external angular@1.[2-5]
//   when running JavaScript tests with Karma
//
// @config: reference {string}
// @reference {string}
