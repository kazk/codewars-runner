"use strict";

const fs = require('fs-extra');
const path = require('path');

module.exports = outputFilesTo;

function outputFilesTo(dir, files) {
  return Promise.all(Object.keys(files).map(k => fs.outputFile(path.join(dir, k), files[k])));
}
