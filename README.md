Temporary package to try multi-package approach.


## TODO

- Develop with Node 7.6+ to make use of `async`/`await`.
  - Use Node 8 when released (`2017-05-30`) which will become LTS.
- Handle Errors
  
## CHANGELOG

### 0.6.0-rc2
  - Changes to `opts.services` is reverted
  - Services are started by `strategies.startService(service, opts)` which returns a Promise.

### 0.6.0-rc1

- Removed `lib/services.js`.
  - `opts.services` is now an array of functions returning promises.
    Either specify them directly, or use `strategies.modifyOpts` to map service name to a function.
  - `C#` uses `opts.services` to add DLLs.
    It should be still possible to support this.

### 0.5.0

- Refactored `lib/shovel.js` to use `async`/`await`

### 0.4.0

- Added tests
- Started to use Promise
- Removed `shovel.CompileError` which was only used by JavaScript with Babel
- Refactor download feature
- Made `shovel.start` return Promise
- Changed tests to use `async`/`await`

### 0.3.0

- Removed `lib/config.js`

- `timeout` should be specified in `opts.timeout`

```json
{
  "timeouts": {
    "default": 12000,
    "go": 15000,
    "haskell": 15000,
    "sql": 14000,
  }
}
```

### 0.2.0

- Changed the signature of `shovel.start`


### 0.1.x

- Original
