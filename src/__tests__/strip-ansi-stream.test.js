const stripAnsiStream = require('../strip-ansi-stream');
const { createStringWriteable } = require('./util');

describe('strip-ansi-stream', () => {
    test('strip simple ansi code', () => {
        const strip = stripAnsiStream();
        const out = createStringWriteable();
        strip.pipe(out);
        strip.write('\u001B[4mUnicorn\u001B[0m');
        expect(out.toString()).toBe('Unicorn');
    });
    
    test('progressive ansi code detection', () => {
        const strip = stripAnsiStream();
        const out = createStringWriteable();
        strip.pipe(out);
        strip.write('Golden \u001b[');
        expect(out.toString()).toBe('Golden ');
        strip.write('4');
        expect(out.toString()).toBe('Golden ');
        strip.write('mUni');
        expect(out.toString()).toBe('Golden ');
        strip.write('corn\u001b[0');
        expect(out.toString()).toBe('Golden Unicorn');
        strip.write('m');
        expect(out.toString()).toBe('Golden Unicorn');
    });
});
