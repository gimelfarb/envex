const fs = require('fs');
const readline = require('readline');
const { once } = require('./util');

module.exports = {
    readEnvFileAsync,
    writeEnvFileAsync,
};

async function readEnvFileAsync(filePath) {
    const input = fs.createReadStream(filePath);
    return await readEnvStreamAsync(input);
}

async function readEnvStreamAsync(input) {
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    
    const env = {};
    rl.on('line', (line) => parseEnvLine(line, env));

    await once(rl, 'close');
    return env;
}

// Borrowed from: https://github.com/motdotla/dotenv
const regexEnvLine = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/;
const regexEnvComment = /^\s*#/;
const regexEnvEmpty = /^\s*$/;

function parseEnvLine(line, env) {
    const m = line.match(regexEnvLine);
    if (m) {
        let { 1: key, 2: val } = m;
        val = val && val.trim();
        if (val) {
            // TODO: quotes and escape handling ...
        }
        env[key] = val;
    } else {
        if (line.match(regexEnvComment)) return;
        if (line.match(regexEnvEmpty)) return;
        throw new Error(`Cannot parse env line: ${line}`);
    }
}

async function writeEnvFileAsync(filePath, env) {
    const output = fs.createWriteStream(filePath);
    writeEnvStream(output, env);
    
    output.close();
    await once(output, 'close');
}

function writeEnvStream(output, env) {
    env = env || {};
    for (const key of Object.keys(env)) {
        writeEnvLine(output, key, env[key]);
    }
}

function writeEnvLine(output, key, value) {
    value = value || '';
    if (typeof value !== 'string') value = `${value}`;
    let quote = '';
    value.replace('\n', () => { quote = '"'; return '\\n'; });
    output.write(`${key}=${quote}${value}${quote}\n`);
}
