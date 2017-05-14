# Runner

A runner is a module implementing following functions and properties.

## Core Functions

### solutionOnly(opts)

```javascript
async function solutionOnly(opts) {
  return {
    name: '',
    args: [],
    options: {}
  };
}
```

```javascript
function solutionOnly(opts) {
  return new Promise((resolve, reject) => {
  });
}
```

### testIntegration(opts)

```javascript
async function testIntegration(opts) {
  return {
    name: '',
    args: [],
    options: {}
  };
}
```

```javascript
function testIntegration(opts) {
  return new Promise((resolve, reject) => {
  });
}
```

## Auxiliary Functions

### modifyOpts(opts)

Allow for language level modification of opts, such as services and shell.

### startService(name, opts)

Services are started by calling `startService(name, opts)` for each name in opts.services.
`startService(name, opts)` returns a Promise.

Commonly used services can be packaged and shared.

### files(opts)

Write `opts.files`. Default behavior is to write all files in `opts.files` under `opts.dir`.

### transformBuffer(buffer, opts)

Transforms the buffer before any additional stdout/err specific processing is made.
Useful for things like when you may want to split stdout into both stdout and stderr.

### sanitizeStdOut(stderr, opts)

### sanitizeStdErr(stderr, opts)

## Auxiliary Properties

### defaultOptions

### outputType

`pre`/`raw`
