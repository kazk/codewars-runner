"use strict";

const got = require('got');
const outputFilesTo = require('../util/output-files-to');

// TODO: Handle Errors
module.exports = function downloadGist(opts) {
  return got('https://api.github.com/gists/' + opts.gist, {
    json: true
  })
  .then((res) => {
    const body = res.body;
    if (body == null || body.files == null) return;
    const files = body.files, keys = Object.keys(files);
    return outputFilesTo(opts.dir, keys.reduce((o, k) => (o[k] = files[k].content, o), {}));
  });
};
