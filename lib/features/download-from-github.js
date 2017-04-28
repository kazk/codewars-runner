"use strict";

const got = require('got');
const download = require('download');
const outputFilesTo = require('../util/output-files-to');

// TODO: Handle Errors
module.exports = downloadFromGitHub;

function downloadFromGitHub(opts) {
  if (opts.githubRepo) return downloadRepo(opts);
  if (opts.gist) return downloadGist(opts);
  return Promise.resolve();
}

function downloadRepo(opts) {
  opts.publish('status', 'Downloading files from Github...');
  return download(normalizedRepoURL(opts.githubRepo), opts.dir, {
    extract: true,
    strip: 1
  });
}

function downloadGist(opts) {
  return got("https://api.github.com/gists/" + opts.gist, {
    json: true
  })
  .then((res) => {
    const body = res.body;
    if (body == null || body.files == null) return;
    const files = body.files, keys = Object.keys(files);
    return outputFilesTo(opts.dir, keys.reduce((o, k) => (o[k] = files[k].content, o), {}));
  });
}

// https://api.github.com/repos/:user/:project/tarball
function normalizedRepoURL(repo) {
  if (!repo.startsWith('https://api.github.com/repos/'))
    repo = 'https://api.github.com/repos/' + repo;
  if (!repo.endsWith('/tarball')) repo += "/tarball";
  return repo;
}
