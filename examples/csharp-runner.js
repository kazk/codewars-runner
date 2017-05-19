"use strict";

const path = require('path');
const fs = require('fs-extra');
const exec = require('child_process').exec;

const _outputFileSync = (path, data) => (fs.outputFileSync(path, data), path);

function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
    const exe = path.join(opts.dir, 'solution.exe');
    const args = [
      'mcs',
      '-out:' + exe,
      _outputFileSync(path.join(opts.dir, 'code.cs'), opts.solution),
    ];
    if (opts.setup)
      args.push(_outputFileSync(path.join(opts.dir, 'setup.cs'), opts.setup));

    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));
      resolve({
        name: 'mono',
        args: [exe]
      });
    });
  });
}

const nunitAssemblies = [
  'nunit.core.dll',
  'nunit.framework.dll',
  'nunit.core.interfaces.dll',
  'nunit.util',
  'Newtonsoft.Json.dll'
].join(',');
const nunitPath = '/runner/frameworks/csharp/nunit/bin';

function testIntegration(opts) {
  return new Promise((resolve, reject) => {
    // copydir('/runner/frameworks/nunit', opts.dir);
    const dll = path.join(opts.dir, 'test.dll');
    const args = [
      'mcs',
      '-out:' + dll,
      `-lib:${opts.dir},/runner/frameworks/csharp/mono-4.5,${nunitPath}`,
      '-langversion:Default',
      '-sdk:4.5',
      '-warn:2',
      '-target:library',
      '-r:' + nunitAssemblies,
      '-r:System.Numerics.dll',
      '-r:System.Drawing.dll',
      '-r:System.Data.dll',
      '-r:System.Data.SQLite.dll',
      '-r:System.Data.SQLite.Linq.dll',
      '-r:System.IO.dll',
      '-r:System.Linq.dll',
      '-r:System.Linq.Dynamic.dll',
      '-r:System.Linq.Expressions.dll',
      '-r:System.Messaging.dll',
      '-r:System.Threading.Tasks.dll',
      '-r:System.Xml.dll',
      '-r:Mono.Linq.Expressions.dll',
    ];

    if (opts.services.includes("mongodb")) {
      args.push('-r:MongoDB.Bson.dll');
      args.push('-r:MongoDB.Driver.Core.dll');
      args.push('-r:MongoDB.Driver.dll');
      args.push('-r:MongoDB.Dynamic.dll');
    }

    if (opts.services.includes("redis")) {
      args.push('-r:StackExchange.Redis.dll');
    }

    if (opts.services.includes("postgres")) {
      args.push('-r:Npgsql.dll');
    }

    // include any references that have been included
    if (opts.references) {
      for (const ref of opts.references) {
        const name = `-r:${ref}`;
        if (!args.includes(name)) args.push(name);
      }
    }

    if (opts.files)
      args.push.apply(args, opts.filePaths.filter(p => /\.cs$/.test(p)));

    if (opts.solution)
      args.push(_outputFileSync(path.join(opts.dir, 'code.cs'), opts.solution));

    if (opts.fixture)
      args.push(_outputFileSync(path.join(opts.dir, 'fixture.cs'), opts.fixture));

    if (opts.setup)
      args.push(_outputFileSync(path.join(opts.dir, 'setup.cs'), opts.setup));

    opts.publish('status', 'Compiling...');
    exec(args.join(' '), function(error, stdout, stderr) {
      if (error) return reject(Object.assign(error, {stdout, stderr}));

      resolve({
        name: "mono",
        args: [
          path.join(nunitPath, 'nunit-console.exe'),
          '-nologo',
          '-noresult',
          dll
        ],
        options: {env: process.env}
      });
    });
  });
}
