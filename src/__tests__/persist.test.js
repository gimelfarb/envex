const { readEnvStreamAsync } = require('../persist');
const { createStringReadable } = require('./util');

describe('persist', () => {
    test('read escaped newline', async () => {
        const inp = createStringReadable([
            'VAR="abc\\ndef"',
            'VAR2=\'abc\\ndef\'',
            'VAR3=abc'
        ].join('\n'));
        const env = await readEnvStreamAsync(inp);
        expect(env.VAR).toBe('abc\ndef');
        expect(env.VAR2).toBe('abc\\ndef');
        expect(env.VAR3).toBe('abc');
    });
});
