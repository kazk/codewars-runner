"use strict";

const path = require("path");
const fs = require('fs-extra');

const fsharpFrameworksPath = '/runner/frameworks/fsharp';
const csharpFrameworksPath = '/runner/frameworks/csharp';
const fuchuPath = path.resolve(fsharpFrameworksPath, 'Fuchu', 'lib', 'Fuchu');

// Fuchu references exception classes from these libs
const nunitAssemblies = [
  'nunit.core.dll',
  'nunit.core.interfaces.dll',
  'nunit.util.dll',
  'nunit.framework.dll',
  'Newtonsoft.Json.dll',
  'Qualified.dll'
];
const nunitPath = path.resolve(csharpFrameworksPath, 'nunit', 'bin');
const gallioPath = path.resolve(fsharpFrameworksPath, 'Gallio', 'lib', 'NET40');
const gallioAssembly = path.resolve(gallioPath, 'Gallio.dll');
const xUnitPath = path.resolve(fsharpFrameworksPath, 'xunit', 'lib', 'net20');
const xUnitAssembly = path.resolve(xUnitPath, 'Xunit.dll');


async function solutionOnly(opts) {
  const file = path.join(opts.dir, 'solution.fsx');
  await fs.outputFile(file, `${opts.setup ? opts.setup + '\n' : ''}${opts.solution}`);
  return {
    name: 'fsharpi',
    args: [file]
  };
}

async function testIntegration(opts) {
  const code = [
    `System.IO.File.Delete("${path.resolve(opts.dir, 'program.fsx')}")`,
    opts.setup ? opts.setup : "",
    opts.solution,
    opts.fixture,
    runFixtureUsingFuchu
  ].join("\n");

  const codeFile = path.join(opts.dir, 'program.fsx');
  await fs.outputFile(codeFile, code);

  const args = [
    '--reference:' + fuchuPath,
    '--lib:' + gallioPath,
    '--reference:' + gallioAssembly,
    '--lib:' + xUnitPath,
    '--reference:' + xUnitAssembly,
    '--lib:' + nunitPath
  ];
  args.push.apply(args, nunitAssemblies.map(d => "--reference:" + path.resolve(nunitPath, d)));
  args.push(codeFile);
  return {
    name: 'fsharpi',
    args: args
  };
}

const runFixtureUsingFuchu = [
  `let printCompletedIn (timeSpan: System.TimeSpan) =`,
  `    printfn "\\n<COMPLETEDIN::>%f" timeSpan.TotalMilliseconds in`,
  `let codeWarsTestPrinter: Fuchu.Impl.TestPrinters =`,
  `    { BeforeRun = (fun name -> printfn "\\n<IT::>%s" name)`,
  `      Passed = (fun name time ->`,
  `          printfn "\\n<PASSED::>%s" (name.Replace("\\n", "<:LF:>"))`,
  `          printCompletedIn time)`,
  `      Ignored = (fun _ _ -> ignore())`,
  `      Failed = (fun name err time ->`,
  `          printfn "\\n<FAILED::>%s" (err.Replace("\\n", "<:LF:>"))`,
  `          printCompletedIn time)`,
  `      Exception = (fun name err time ->`,
  `          printfn "\\n<ERROR::>%s" (err.StackTrace.Replace("\\n", "<:LF:>"))`,
  `          printCompletedIn time) }`,
  `let _ =`,
  `    Fuchu.Impl.eval codeWarsTestPrinter Seq.map Tests.suite;;`
].join('\n');
