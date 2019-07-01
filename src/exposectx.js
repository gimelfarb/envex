const stream = require('stream');
const StreamSnitch = require('stream-snitch');

module.exports = {
    createExposeContext,
};

function createExposeContext() {
    const fns = [];

    /**
     * Append expose config definition. Can be a list of maps, or a sync/async function that
     * resolves to list or map. In a map, each key represents an expose var, with value
     * either as string, value function or object definition.
     * 
     * @param {import('../index').envex.ExposeConfig} map List, map or sync/async function that resolves to list or map
     */
    const extend = (map) => {
        if (Array.isArray(map)) {
            map.map(extend);
        } else if (typeof map === 'function') {
            const fn = map;
            fns.push(
                /** @param {ExposeApplyContext} ctx */
                async (ctx) => {
                    const { env, tap, expose } = ctx;
                    const map = await fn({ env, tap }, expose);
                    if (typeof map !== 'undefined') expose(map);
                }
            );
        } else if (map && typeof map === 'object') {
            for (const key of Object.keys(map)) {
                const val = map[key];
                if (typeof val === 'function') {
                    const valfn = val;
                    fns.push(async (ctx) => {
                        const { env, tap } = ctx;
                        const expose = (val) => ctx.expose({ [key]: `${val}` });
                        const val = await valfn({ env, tap }, expose);
                        if (typeof val !== 'undefined') expose(val);
                    });
                } else if (val && typeof val === 'object') {
                    let { regex } = val;
                    if (regex) {
                        if (typeof regex === 'string') regex = new RegExp(regex);
                        if (!(regex instanceof RegExp)) throw new Error(`Invalid regex value: ${regex}`);
                        fns.push((ctx) => {
                            const { tap } = ctx;
                            tap.pipe(new StreamSnitch(regex, (m) => {
                                ctx.expose({ [key]: m[1] });
                            }, { bufferCap: 4096 }))
                        });
                    }
                } else {
                    fns.push((ctx) => ctx.expose({ [key]: `${val}` }));
                }
            }
        } else if (typeof map === 'string') {
            const name = map;
            fns.push((ctx) => ctx.expose({ [name]: ctx.env[name] }));
        }
    };

    /**
     * Context for applying expose config.
     * @typedef {object} ExposeApplyContext
     * @prop {import('../index').envex.EnvResolved} env
     * @prop {import('stream').Readable} tap
     * @prop {(map: import('../index').envex.ExposeResolved) => void} expose
     */

    /** 
     * Materialises entire expose config, by executing pending functions to expose configured
     * values. Starts listening on the tap stream, to expose new values dynamically as they appear.
     * 
     * @param {ExposeApplyContext} ctx
     */
    const apply = async (ctx) => {
        let { env, tap, expose } = ctx;
        env = env || {};
        tap = tap || createEmptyTap();
        expose = expose || (() => {});

        for(const fn of fns) {
            await fn({ env, tap, expose });
        }
    };

    return {
        extend,
        apply,
    };
}

function createEmptyTap() {
    const s = new stream.Readable({ read() {} });
    s.push(null);
    return s;
}
