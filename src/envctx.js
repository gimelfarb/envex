const { Deferred } = require('./util');

module.exports = {
    createEnvContext,
};

/**
 * Creates a context in which env definitions are processed. Exposes
 * two methods: extend() - to define env, close() - to resolve all definitions.
 * 
 * @param {import('../index').envex.EnvResolved} parentEnv 
 */
function createEnvContext(parentEnv) {
    parentEnv = createReadOnlyEnv(parentEnv);
    const defn = {};
    let defnpromise = Promise.resolve();

    const _has = (name) => {
        return (name in parentEnv) || (name in defn);
    };

    /**
     * Append env var definitions. Can be a list of maps, or a sync/async function that
     * resolves to list or map. In a map, each key represents an env var, with value
     * either as string, value function or object definition.
     * 
     * @param {import('../index').envex.EnvConfig} map List, map or sync/async function that resolves to list or map
     */
    const extend = (map) => {
        // Internally perform extension as async, to handle
        // async value functions
        const _extend = async (map) => {
            if (Array.isArray(map)) {
                return Promise.all(map.map(_extend));
            }
            else if (typeof map === 'function') {
                const ctx = { env: parentEnv, has: _has };
                return _extend(await map(ctx));
            }
            else if (typeof map === 'string') {
                const key = map;
                return _extend({ [key]: {} });
            }
            else if (map && typeof map === 'object') {
                for (const key of Object.keys(map)) {
                    const { name, def } = parseEnvKey(key);
                    const val = map[key];

                    if (typeof val === 'object') {
                        Object.assign(def, val);
                    } else {
                        Object.assign(def, { required: true, value: val });
                    }
                    
                    if (name in defn) {
                        Object.assign(defn[name], def);
                    } else {
                        if (!def.override && name in parentEnv) continue;
                        defn[name] = def;
                    }
                }
            }
        };

        // Chain all async extend operations
        defnpromise = defnpromise.then(() => _extend(map));
    };

    /**
     * Resolves all of the defined env var definitions. Returns a promise which will
     * resolve once all of the async operations complete.
     * 
     * Note that resolved env map doesn't include parent env variables.
     * 
     * @param {(cmd: string, profile?: string) => Promise<string>} [cmdrun] Resolver for command variable expansion
     * @returns {Promise<import('../index').envex.EnvResolved>} resolved env definition
     */
    const resolve = async (cmdrun) => {
        // Must await for all async definition operations
        // to complete
        await defnpromise;

        // Setup a wait map, which will keep a promise for
        // each env var to be resolved (all resolves are async)
        const wait = {};
        const _wait = (name) => {
            let waiter = wait[name];
            if (!waiter) {
                const d = new Deferred();
                wait[name] = waiter = {
                    name,                       // name of the env var
                    promise: d.promise,         // promise for resolved value
                    resolve: d.resolve,         // resolves promise
                    reject: d.reject,           // rejects promise
                    dep: [],                    // records which vars this depends on
                    defined: false,             // flag whether var was defined through extend()
                };
            }
            return waiter;
        };

        // Sets up a resolver function which can expand env strings
        // It depends on the 'waiter' which represents that var, in context
        // of which we are performing resolutions. This is important for tracking
        // dependencies (to detect circular dependencies).
        const _resolve = (waiter) => async (s) => {
            // Split env str into tokens
            const parsed = parseEnvStr(s);
            const promises = [];
            const { name, dep } = waiter;
            // Process special tokens, i.e. var references and inline
            // command executions
            parsed.forEach(p => {
                if (p.type === 'var') {
                    // Prefer the explicitly defined variable first, unless
                    // we are self-referring (which means we actually want
                    // parent env value)
                    if (p.name in defn && name !== p.name) {
                        dep.indexOf(p.name) < 0 && dep.push(p.name);
                        promises.push(_wait(p.name).promise.then(s => p.val = s));
                    } else if (p.name in parentEnv) {
                        p.val = `${parentEnv[p.name]}`;
                    } else {
                        throw new Error(`Undefined env var: ${p.name}`);
                    }
                }
                else if (p.type === 'cmd') {
                    const { cmd, profile } = p;
                    if (typeof cmdrun !== 'function') throw new Error(`No command runner to resolve: $(${cmd})`);
                    promises.push(cmdrun(cmd, profile).then(s => p.val = s));
                }
            });
            // Wait for the async parts to complete
            if (promises.length) {
                await Promise.all(promises);
            }
            // Then resolved str is concatenation of resolved bits
            const resolved = parsed.map(p => p.val || p).join('');
            return resolved;
        };

        // Waitlist is a list of all defined variables we are waiting
        // to resolve, in a list form
        const waitlist = [];

        for (const name of Object.keys(defn)) {
            const def = defn[name];
            const val = def.value;
            if (typeof val === 'undefined' || val === null) {
                if (def.required) throw new Error(`Missing required env: ${name}`);
                continue;
            }

            const waiter = _wait(name);
            waiter.defined = true;
            waitlist.push(waiter);

            // Processing a variable involves either resolving its string
            // value, or invoking the function and resolving return string
            const resolve = _resolve(waiter);
            const process = async (val) => {
                if (typeof val === 'function') {
                    const ctx = { env: parentEnv, has: _has, resolve };
                    const ret = await val(ctx);
                    return await resolve(`${ret}`);
                } else {
                    return await resolve(`${val}`);
                }
            };

            process(val).then(waiter.resolve, waiter.reject);
        }

        // Perform final checks on waited env vars
        for (const name of Object.keys(wait)) {
            const waiter = wait[name];
            // If something referred to a future variable, but it was never defined
            if (!waiter.defined) {
                waiter.reject(new Error(`Undefined env var: ${name}`));
            }
            // Check for circular dependencies, to break infinite waits. This starts
            // from dependencies, and recursively continues walking all the deps they
            // depend on. This continues until we detect a cycle.
            const cycle = {};
            for (let dep = waiter.dep; dep.length > 0; ) {
                // Cycle is detected if we have visited this var already
                let detected = false;
                const newdeps = dep.map(d => { 
                    detected = detected || cycle[d];
                    cycle[d] = true; 
                    return wait[d].dep;
                });

                if (detected) {
                    waiter.reject(new Error(`Circular dependency: ${name}`));
                    break;
                }

                dep = newdeps.reduce((all, chunk) => all.concat(chunk), [])
            }
        }

        // Now ready to wait for resolved values for all env vars we are
        // waiting on. There are no circular dependencies, so this should
        // complete eventually (in theory).
        const env = {};
        for (const waiter of waitlist) {
            const { name, promise } = waiter;
            env[name] = await promise;
        }
        
        return env;
    };

    // External context API - extend() and resolve()
    return {
        extend,
        resolve,
    };
}

function createReadOnlyEnv(env) {
    if (env === process.env) return Object.freeze({...env});
    return Object.freeze(env || {});
}

function parseEnvKey(key) {
    let name = key || '';
    let def = { required: true };
    if (name.length > 1 && name[0] === '[' && name[name.length - 1] === ']') {
        name = name.substring(1, name.length - 1);
        def.required = false;
    }
    else if (name.length > 0 && name[name.length - 1] === '?') {
        name = name.substring(0, name.length - 1);
        def.required = false;
    }
    else if (name.length > 0 && name[name.length - 1] === '!') {
        name = name.substring(0, name.length - 1);
        def.override = true;
    }
    if (!name.length) throw new Error('Empty environment variable name');
    return { name, def };
}

function parseEnvStr(s) {
    const regex = /\$\{([^${}]*)\}|\$([a-z0-9_]+)|\$\(((?:(?:\\\))|[^)])*)\)/gi;
    let m, i = 0, res = [];
    while ((m = regex.exec(s))) {
        if (i < m.index) res.push(s.substring(i, m.index));
        i = m.index + m[0].length;

        if (m[1]) {
            res.push({ type: 'var', name: m[1] });
        } else if (m[2]) {
            res.push({ type: 'var', name: m[2] });
        } else if (m[3]) {
            let cmd = m[3], profile;
            cmd = cmd.replace('\\)', ')');
            const rxcmd = /^(?:\[([^\]]*)\]\s*)?/i;
            const mc = rxcmd.exec(cmd);
            if (mc) {
                profile = mc[1];
                cmd = cmd.substring(mc[0].length);
            }
            res.push({ type: 'cmd', cmd, profile });
        }
    }
    if (i < s.length) res.push(s.substring(i, s.length));
    return res;
}