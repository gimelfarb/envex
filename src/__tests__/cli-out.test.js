const { cli } = require('..');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const tmp = require('tmp-promise');
const { 
    createStringWriteable, 
    writeFile,
    createCheckedCli,
} = require('./util');

const fsasync = {
    exists: promisify(fs.exists)
};

const chk_cli = createCheckedCli(cli);

describe('cli-out', () => {
    /** @type {import('tmp-promise').DirectoryResult} */
    let _dir;
    let _originalCwd;
    beforeEach(async () => {
        _dir = await tmp.dir({ unsafeCleanup: true });
        _originalCwd = process.cwd();
        process.chdir(_dir.path);
    });
    afterEach(async () => {
        await _dir.cleanup();
        process.chdir(_originalCwd);
    });

    test('out simple', async () => {
        await writeFile(path.resolve(_dir.path, '.envexrc.json'), {
            profiles: {
                'init': {
                    expose: {
                        'VAR': 'abc'
                    }
                },
                'app': {
                    imports: ['simple.env']
                }
            }
        });

        expect(await fsasync.exists('simple.env')).toBe(false);
        await chk_cli(['-p', 'init', '--out', 'simple.env']);
        expect(await fsasync.exists('simple.env')).toBe(true);

        const cli_out = createStringWriteable();
        await chk_cli(['-p', 'app', 'node', '-e', 'process.stdout.write(process.env.VAR)'], cli_out);
        expect(cli_out.toString()).toBe('abc');
    });

    test('out complex', async () => {
        await writeFile(path.resolve(_dir.path, '.envexrc.json'), {
            profiles: {
                'init': {
                    env: {
                        // And unfortunate hack - we have to escape ')' inside $(...) expression
                        'VAR': '$(node -e "console.log(\'xyz\'\\)")'
                    },
                    expose: ['VAR']
                },
                'app': {
                    imports: ['complex.env']
                }
            }
        });

        expect(await fsasync.exists('complex.env')).toBe(false);
        await chk_cli(['-p', 'init', '--out', 'complex.env']);
        expect(await fsasync.exists('complex.env')).toBe(true);

        const cli_out = createStringWriteable();
        await chk_cli(['-p', 'app', 'node', '-e', 'process.stdout.write(process.env.VAR)'], cli_out);
        expect(cli_out.toString()).toBe('xyz');
    });

    test('out extracted', async () => {
        await writeFile(path.resolve(_dir.path, '.envexrc.json'), {
            profiles: {
                'init': {
                    expose: {
                        'VAR': {
                            regex: '(\\d+)'
                        }
                    }
                },
                'app': {
                    imports: ['extracted.env']
                }
            }
        });

        expect(await fsasync.exists('extracted.env')).toBe(false);
        await chk_cli(['-p', 'init', '--out', 'extracted.env', 'node', '-e', 'console.log(\'result is 123\')']);
        expect(await fsasync.exists('extracted.env')).toBe(true);

        const cli_out = createStringWriteable();
        await chk_cli(['-p', 'app', 'node', '-e', 'process.stdout.write(process.env.VAR)'], cli_out);
        expect(cli_out.toString()).toBe('123');
    });
});