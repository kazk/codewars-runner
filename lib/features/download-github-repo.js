"use strict";

const download = require('download');

// TODO: Handle Errors
module.exports = function downloadRepo(opts) {
  opts.publish('status', 'Downloading files from Github...');
  return download(normalizedRepoURL(opts.githubRepo), opts.dir, {
    extract: true,
    strip: 1
  });
};

// https://api.github.com/repos/:user/:project/tarball
function normalizedRepoURL(repo) {
  if (!repo.startsWith('https://api.github.com/repos/'))
    repo = 'https://api.github.com/repos/' + repo;
  if (!repo.endsWith('/tarball')) repo += '/tarball';
  return repo;
}
