const stream = require('stream');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { promisify } = require('util');
const { runChildAsync } = require('../exec');

const fsasync = {
    writeFile: promisify(fs.writeFile)
};

module.exports = {
    createDeferred,
    createStringReadable,
    createStringWriteable,
    createSignalServer,
    writeFile,
    cliexec,
    createCheckedCli,
    delay
}

function createStringReadable(s) {
    const inp = new stream.Readable();
    inp.push(s);
    inp.push(null);
    return inp;
}

function createStringWriteable() {
    let str = '';
    const out = new stream.Writable({
        write(chunk, _encoding, cb) {
            str += chunk.toString();
            cb();
        }
    });
    out.toString = () => str;
    return out;
}

function createSignalServer() {
    const d = createDeferred();
    let dwait = createDeferred();
    let pending = [];
    const srv = http.createServer((_req, res) => {
        pending.push(res);
        dwait.resolve();
    });
    srv.on('listening', () => {
        const port = srv.address().port;
        d.resolve({
            url: `http://localhost:${port}/`,
            close: () => {
                pending.forEach(res => res.writeHead(500).end());
                srv.close();
            },
            connected: () => dwait.promise,
            signal: () => {
                pending.forEach(res => res.end());
                pending = [];
                dwait = createDeferred();
            }
        });
    });
    srv.listen();
    return d.promise;
}

function createDeferred() {
    let d;
    let p = new Promise((resolve, reject) => d = { resolve, reject });
    d.promise = p;
    return d;
}

async function writeFile(filepath, content) {
    let data;
    if (typeof content === 'string') {
        data = content;
    }
    else if (typeof content === 'object') {
        data = JSON.stringify(content);
    }
    else if (typeof content === 'function') {
        data = await content();
        return await writeFile(filepath, data);
    }
    await fsasync.writeFile(filepath, data);
}

async function cliexec(args, opts) {
    const cmd = 'node';
    const cmdargs = [
        path.resolve(__dirname, '../../bin/envex.js'),
        ...args
    ];

    return await runChildAsync(cmd, cmdargs, opts);
}

function createCheckedCli(clifn) {
    if (typeof clifn !== 'function') throw new Error('Expecting function');
    const name = clifn.name;
    return async (...args) => {
        const { signal, code } = await clifn(...args);
        if (signal) throw new Error(`Signal exit: ${signal} [ ${name}(...) ]`);
        if (code) throw new Error(`Non-zero exit code: ${code} [ ${name}(...) ]`);
    };
}

async function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
