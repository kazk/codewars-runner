"use strict";

const fs = require('fs-extra');
const path = require('path');

module.exports = function outputFileTo(dir, name, data) {
  return fs.outputFile(path.join(dir, name), data);
};
