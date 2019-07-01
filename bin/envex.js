#!/usr/bin/env node
/* eslint-disable no-console */
const { cli } = require('../src');
const args = process.argv.slice(2);
cli(args, process.stdout)
    .then(({ code, signal }) => {
        signal ? process.kill(process.pid, signal) : process.exit(code);
    })
    .catch(err => {
        console.error('envex err: ', err);
        process.exit(-1);
    });
