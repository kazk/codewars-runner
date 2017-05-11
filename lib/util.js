"use strict";

const fs = require('fs');
const path = require('path');

module.exports = {
  mkdirParentSync,
  writeFileSync,
  writeFilesSync,
  codeWriteSync,
};

// mkdir -p
function mkdirParentSync(dirPath, mode) {
  const dirs = dirPath.split("/");
  var partialPath;
  for (var idx = (dirPath[0] == '/' ? 1 : 0); idx < dirs.length; idx++) {
    partialPath = dirs.slice(0, idx + 1).join("/");
    if (!fs.existsSync(partialPath)) fs.mkdirSync(partialPath, mode);
  }
}

// Infer the name of a file from a module or namespace declaration in the code
function codeFileName(language, code, defaultFileName) {
  if (moduleRegExs[language]) {
    const moduleMatch = moduleRegExs[language].exec(code);
    if (moduleMatch !== null) {
      return moduleMatch[1].replace(/\./g, '/').replace(/-/g, '_') + '.' + fileExtensions[language];
    }
    if (defaultFileName) {
      const ext = '.' + fileExtensions[language];
      if (defaultFileName.endsWith(ext)) return defaultFileName;
      return defaultFileName + ext;
    }
  }
  return defaultFileName || language;
}

function codeWriteSync(language, code, codeDir, defaultFileName, overwrite) {
  const fileName = codeFileName(language, code, defaultFileName);
  if (typeof fileName != 'string')
    throw new Error("Could not determine valid name from code:\n\n" + code);
  if (!code) throw new Error("Code cannot be empty!");
  return writeFileSync(codeDir, fileName, code, overwrite);
}

function writeFileSync(dir, fileName, content, overwrite) {
  overwrite = overwrite !== false;
  fileName = path.join(dir || '/home/codewarrior', fileName);

  if (!overwrite && fs.existsSync(fileName))
    throw new Error(`Could not write code to file ${fileName} because file already exists:\n\n${content}`);
  mkdirParentSync(path.dirname(fileName));
  fs.writeFileSync(fileName, content);
  return fileName;
}

// writes multiple files. Also allows you to transform the content before it gets written. Files should be an object
// with keys mapping to file names and values mapping to file content.
function writeFilesSync(dir, files, overwrite, transform) {
  if (files) {
    Object.keys(files).forEach(function(fileName) {
      var content = files[fileName];
      if (transform) content = transform(fileName, content);
      writeFileSync(dir, fileName, content, overwrite);
    });
  }
}

const moduleRegExs = {
  haskell: /module\s+([A-Z]([a-z|A-Z|0-9]|\.[A-Z])*)\W/,
  julia: /module\s+([a-z|A-Z][a-z|A-Z|0-9]*)\W/,
  erlang: /-module\(([a-z|A-Z][a-z|A-Z|0-9|_]*)\)/,
  elixir: /defmodule\s+([a-z|A-Z][.a-z|A-Z|0-9|_]*)\s+do/,
  scala: /(?:object|class)\s+([A-Z][a-z|A-Z|0-9|_]*)/,
  kotlin: /(?:object|class)\s+([A-Z][a-z|A-Z|0-9|_]*)/,
  swift: /\n*\/\/\s*([a-z|A-Z|0-9|_|-]+)\.swift\s*\n/,
  objc: /\n*\/\/\s*([a-z|A-Z|0-9|_|-]+)\.m\s*\n/,
  objcHeader: /\n*\/\/\s*([a-z|A-Z|0-9|_|-]+)\.h\s*\n/
};

const fileExtensions = {
  c: 'c',
  cpp: 'cpp',
  coffeescript: 'coffee',
  crystal: 'cr',
  csharp: 'cs',
  elixir: 'ex',
  erlang: 'erl',
  fsharp: 'fs',
  go: 'go',
  groovy: 'groovy',
  haskell: 'hs',
  java: 'java',
  javascript: 'js',
  julia: 'jl',
  kotlin: 'kt',
  objc: 'm',
  objcHeader: 'h',
  ruby: 'rb',
  scala: 'scala',
  shell: 'sh',
  sql: 'sql',
  swift: 'swift',
};
