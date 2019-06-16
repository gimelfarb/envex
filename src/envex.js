const stream = require('stream');
const stripAnsiStream = require('strip-ansi-stream');
const stringArgv = require('string-argv').default;
const { loadConfigAsync } = require('./config');
const { createEnvContext } = require('./envctx');
const { createExposeContext } = require('./exposectx');
const { runChildAsync } = require('./exec');
const { streamToString } = require('./util');
const { writeEnvFileAsync } = require('./persist');
const exposesrv = require('./expose');

class Envex {

    async loadConfig(rc_file) {
        this.configCtx = await loadConfigAsync(rc_file);
    }

    async selectProfile(profile) {
        const config = await this.configCtx.profile(profile);
        this.config = { profile, ...config };
        this.profile = profile;
    }

    async resolveEnv(parent_env) {
        this.env = await this._env(parent_env);
    }

    async attachExpose(mode, ...args) {
        if (mode === 'server') {
            this.exposer = combineExposers(this.exposer, createServerExposer(this.profile));
        }
        else if (mode === 'file') {
            const [ filePath ] = args;
            if (!filePath) throw new Error('Missing file path');
            this.exposer = combineExposers(this.exposer, createFileExposer(filePath));
        }
    }

    async evalCmd(child_cmd, child_args) {
        const env = this.env;
        const { cwd } = this.config || {};

        let strpromise;
        const stdio = {
            stdin: 'ignore',
            stdout: (out) => strpromise = streamToString(out),
            stderr: 'ignore'
        };

        const { code } = await runChildAsync(child_cmd, child_args, { stdio, env, cwd });
        if (code) throw new Error(`Process exit code (${code}) is non-zero: ${child_cmd}`);

        let str = await strpromise;
        str = str.replace(/(\r?\n|\r)+$/, '');
        return str;
    }

    async runCmd(child_cmd, child_args) {
        const env = this.env;
        const { cwd } = this.config || {};
        let stdio;

        if (this.config && this.exposer) {
            const exposectx = createExposeContext();
            exposectx.extend(this.config.expose);

            const expose = (map) => this.exposer.expose(map);
            const tap = createTapStream();
            await exposectx.apply({ env, tap, expose });

            tap.pipe(createSinkStream());

            stdio = {
                stdin: 'inherit',
                stdout: (out) => out.pipe(createChildFilterStream(tap)).pipe(process.stdout),
                stderr: (out) => out.pipe(createChildFilterStream(tap)).pipe(process.stderr)
            };
        }

        try {
            return await runChildAsync(child_cmd, child_args, { stdio, env, cwd });
        } finally {
            this.exposer && (await this.exposer.close());
        }
    }

    async runExpose() {
        const env = this.env;
        if (this.config && this.exposer) {
            const exposectx = createExposeContext();
            exposectx.extend(this.config.expose);

            const expose = (map) => this.exposer.expose(map);
            const tap = createTapStream();
            await exposectx.apply({ env, tap, expose });

            tap.end();
            await this.exposer.close();
        }
    }

    async getRemoteVar(key) {
        const srv = await exposesrv.connectRemoteAsync(this.profile);
        const val = await srv.getAsync(key);
        srv.disconnect();
        return val;
    }

    async _env(parent_env) {
        parent_env = parent_env || process.env;
        let env = parent_env;

        if (this.config && this.config.env) {
            const envctx = createEnvContext(parent_env);
            envctx.extend(this.config.env);
            const cmdrun = async (cmd, profile) => this._cmdeval(cmd, profile, parent_env);
            env = { ...parent_env, ...(await envctx.resolve(cmdrun)) };
        }

        return env;
    }

    async _cmdeval(cmd, profile, parent_env) {
        const envex = new Envex();
        envex.configCtx = this.configCtx;
        if (profile) {
            await envex.selectProfile(profile);
        }
        const [ child_cmd, ...child_args ] = stringArgv(cmd);
        await envex.resolveEnv(parent_env);
        return await envex.evalCmd(child_cmd, child_args);
    }
}

function createServerExposer(srvname) {
    let exposerp;
    return {
        expose(map) {
            map = map || {};
            exposerp = exposerp || exposesrv.startExposingAsync(srvname);
            exposerp.then(exposer => {
                Object.keys(map).forEach(key => exposer.set(key, map[key]));
            });
        },
        async close() {
            exposerp && (await exposerp).close();
        }
    };
}

function createFileExposer(filePath) {
    let env;
    return {
        expose(map) {
            env = {...env, ...map};
        },
        async close() {
            await writeEnvFileAsync(filePath, env);
        }
    };
}

function combineExposers(exposer, addition) {
    if (!exposer) return addition;
    if (!addition) return exposer;
    if (typeof exposer._push === 'function') {
        exposer._push(addition);
        return exposer;
    }
    const exposers = [exposer, addition];
    return {
        _push: (exposer) => exposers.push(exposer),
        expose: (map) => exposers.forEach(e => e.expose(map)),
        close: () => Promise.all(exposers.map(e => e.close()))
    };
};

function createTapStream() {
    return stripAnsiStream();
}

function createSinkStream() {
    return new stream.Writable({
        write() {}
    });
}

function createChildFilterStream(tap) {
    return new stream.Transform({
        transform(chunk, encoding, cb) {
            tap && tap.write(chunk, encoding);
            cb(null, chunk);
        },
        flush(cb) {
            tap && tap.end();
            cb();
        }
    });
}

module.exports = {
    Envex,
};
