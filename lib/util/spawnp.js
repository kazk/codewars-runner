"use strict";

const spawn = require('child_process').spawn;

const KB = 1024;
const MAX_BUFFER = KB * 1500; // 1.5mb
const MAX_DATA_BUFFER = KB * 50; //50kb is the max that can be written at once.

module.exports = spawnp;

function spawnp(cmd, args = [], options = {}, stdin = '', opts) {
  return new Promise((resolve, reject) => {
    var stdout = '', stderr = '';
    var stdoutLen = 0;
    var maxBufferReached = false;
    var maxTimeReached = false;
    const child = spawn(cmd, args, options);
    const start = process.hrtime();

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', text => {
        opts.publish('stdout', text);
        if (text.length > MAX_DATA_BUFFER) {
          text = text.substr(0, MAX_DATA_BUFFER) + '\n';
          text += `Content truncated due to max data buffer of ${MAX_DATA_BUFFER / KB}kb being reached. Try flushing buffer with less content.\n`;
        }
        stdoutLen += text.length;
        stdout += text;
        if (stdoutLen > MAX_BUFFER) {
          maxBufferReached = true;
          child.kill('SIGKILL');
        }
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', text => {
        opts.publish('stderr', text);
        stderr += text;
      });
    }

    child.on('close', (code, signal) => {
      child.removeAllListeners();
      const diff = process.hrtime(start);
      const res = {
        stdout,
        stderr,
        exitCode: code,
        exitSignal: signal,
        status: '',
        wallTime: Math.ceil(diff[0]*1e3 + diff[1]*1e-6),
      };
      if (code === 0) return resolve(res);

      if (maxBufferReached) {
        res.status = 'max_buffer_reached';
        const msg = 'Max Buffer reached: Too much information has been written to stdout.';
        opts.publish('stdout', msg);
        res.stderr += msg + '\n';
        return resolve(res);
      }

      if (maxTimeReached) {
        res.status = 'max_time_reached';
        const msg = `Process was terminated. It took longer than ${opts.timeout}ms to complete.`;
        opts.publish('stdout', msg);
        res.stderr += msg + '\n';
        return resolve(res);
      }

      return reject(Object.assign(new Error(`Process terminated`), res));
    });

    child.on('error', (error) => {
      child.removeAllListeners();
      reject(Object.assign(error, {stdout, stderr}));
    });

    if (child.stdin && stdin) {
      child.stdin.setDefaultEncoding('utf8');
      child.stdin.end(stdin);
    }

    setTimeout(function() {
      maxTimeReached = true;
      child.kill('SIGKILL');
    }, opts.timeout);
  });
}
