const { cli } = require('..');
const path = require('path');
const tmp = require('tmp-promise');
const { 
    createSignalServer, 
    createStringWriteable, 
    writeFile,
    cliexec,
    createCheckedCli,
    delay
} = require('./util');

const chk_cli = createCheckedCli(cli);
const chk_cliexec = createCheckedCli(cliexec);

describe('cli-ipc', () => {
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

    test('expose simple', async () => {        
        await writeFile(path.resolve(_dir.path, '.envexrc.json'), {
            profiles: {
                'srv': {
                    expose: {
                        'VAR': 'abc'
                    }
                }
            }
        });

        const srv = await createSignalServer();
        try {
            const cli_srv_p = chk_cli(['-p', 'srv', 'node', '-e', `require('http').get('${srv.url}')`]);
            await Promise.race([srv.connected(), cli_srv_p]);

            const client_out = createStringWriteable();
            await chk_cliexec(['-p', 'srv', 'get', 'VAR'], {
                cwd: _dir.path,
                stdio: {
                    stdout: (tap) => tap.pipe(client_out)
                }
            });
            expect(client_out.toString()).toMatch('abc');

            srv.signal();
            await cli_srv_p;
        } finally {
            srv.close();
        }
    });

    test('expose regex', async () => {
        await writeFile(path.resolve(_dir.path, '.envexrc.json'), {
            profiles: {
                'srv': {
                    expose: {
                        'VAR': {
                            regex: '\\[(\\w+)\\]'
                        }
                    }
                }
            }
        });

        const srv = await createSignalServer();
        try {
            await writeFile(path.resolve(_dir.path, 'srv.js'), `
                const axios = require('axios');
                const p = (async () => {
                    await axios.get('${srv.url}');
                    console.log('Output is being monitored [abc]');
                    await axios.get('${srv.url}');
                })();
                p.catch(err => console.error('srv error: ', err.message || err));
            `);

            const NODE_PATH = path.resolve(__dirname, '../../node_modules');
            const cli_srv_p = chk_cliexec(['-p', 'srv', 'node', 'srv.js'], { 
                stdio: 'inherit', 
                env: { NODE_PATH },
                cwd: _dir.path
            });
            await Promise.race([srv.connected(), cli_srv_p]);

            await expect(chk_cli(['-p', 'srv', 'get', 'VAR'])).rejects.toThrow();
            
            srv.signal();
            await delay(300);
            await Promise.race([srv.connected(), cli_srv_p]);
 
            const client_out = createStringWriteable();
            await chk_cli(['-p', 'srv', 'get', 'VAR'], client_out);
            expect(client_out.toString().replace(/(\r?\n|\r)+$/, '')).toBe('abc');

            srv.signal();
            await cli_srv_p;
        } finally {
            srv.close();
        }
    });
});


