"use strict";

const outputFileTo = require('./output-file-to');

module.exports = function outputFilesTo(dir, files) {
  return Promise.all(Object.keys(files).map(k => outputFileTo(dir, k, files[k])));
};
