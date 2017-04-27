Temporary package to try multi-package approach.


---

## TODO

- Promisify
- Separate `lib/services.js`


## CHANGELOG

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
