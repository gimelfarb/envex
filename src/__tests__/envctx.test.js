const { createEnvContext } = require('../envctx');

describe('envctx', () => {
    test('unknown var', async() => {
        const ctx = createEnvContext();
        ctx.extend({ 
            'A': '$B'
        });
        await expect(ctx.resolve()).rejects.toThrow('Undefined env var: B');
    });

    test('simple resolve', async () => {
        const ctx = createEnvContext();
        ctx.extend({ 
            'A': 'abc', 
            'B': (ctx) => ctx.resolve('$A') 
        });
        const env = await ctx.resolve();
        expect(env.A).toBe('abc');
        expect(env.B).toBe('abc');
    });

    test('simple async resolve', async () => {
        const ctx = createEnvContext();
        ctx.extend({ 
            'A': async () => 'abc',
            'B': (ctx) => ctx.resolve('$A')
        });
        const env = await ctx.resolve();
        expect(env.A).toBe('abc');
        expect(env.B).toBe('abc');
    });

    test('circular dependency resolve', async () => {
        const ctx = createEnvContext();
        ctx.extend({
            'A': async (ctx) => ctx.resolve('$B'),
            'B': async (ctx) => ctx.resolve('$A')
        });
        await expect(ctx.resolve()).rejects.toThrow('Circular dependency');
    });

    test('simple expansion', async () => {
        const ctx = createEnvContext();
        ctx.extend({
            'A': 'abc',
            'B': '$A'
        });
        const env = await ctx.resolve();
        expect(env.A).toBe('abc');
        expect(env.B).toBe('abc');
    });

    test('simple async expansion', async () => {
        const ctx = createEnvContext();
        ctx.extend({
            'A': async () => 'abc',
            'B': '$A'
        });
        const env = await ctx.resolve();
        expect(env.A).toBe('abc');
        expect(env.B).toBe('abc');
    });

    test('circular dependency expansion', async () => {
        const ctx = createEnvContext();
        ctx.extend({
            'A': '$E',
            'B': '$C',
            'C': '$D',
            'D': '$B',
            'E': 'abc', 
        });
        await expect(ctx.resolve()).rejects.toThrow('Circular dependency: B');
    });

    test('long dependency expansion', async () => {
        const ctx = createEnvContext();
        ctx.extend({
            'A': '$B-A',
            'B': '$C-B',
            'C': '$D-C',
            'D': '$E-D',
            'E': 'abc-E', 
        });
        const env = await ctx.resolve();
        expect(env.A).toBe('abc-E-D-C-B-A');
        expect(env.B).toBe('abc-E-D-C-B');
        expect(env.C).toBe('abc-E-D-C');
        expect(env.D).toBe('abc-E-D');
        expect(env.E).toBe('abc-E');
    });

    test('inherit var', async () => {
        const ctx = createEnvContext({ 'PORT': '80' });
        ctx.extend({
            'MYPORT': '${PORT}'
        });
        const env = await ctx.resolve();
        expect(env.MYPORT).toBe('80');
    });

    test('inherit and do not override by default', async () => {
        const ctx = createEnvContext({ 'PATH': '/bin' });
        ctx.extend({
            'PATH': '/usr/local/bin'
        });
        const env = await ctx.resolve();
        expect(env.PATH).toBeUndefined();
    });

    test('inherit and extend var', async () => {
        const ctx = createEnvContext({ 'PATH': '/bin' });
        ctx.extend({
            // force override: trailing '!'
            'PATH!': '${PATH}:/usr/local/bin'
        });
        const env = await ctx.resolve();
        expect(env.PATH).toBe('/bin:/usr/local/bin');
    });

    test('inherit without resolving', async () => {
        // Just to make a point, this will not be normally possible, since
        // parent env will always be fully resolved
        const ctx = createEnvContext({ 'API_URL': 'https://${API_HOST}/' });
        ctx.extend({
            'MY_API_URL': '$API_URL',
            'API_HOST': 'abc'
        });
        const env = await ctx.resolve();
        expect(env.MY_API_URL).toBe('https://${API_HOST}/');
    });
});