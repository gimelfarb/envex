const { mockProcessExit } = require('jest-mock-process');
const mockConsole = require('jest-mock-console').default;
const mockedEnv = require('mocked-env');
const { processArgs } = require('../cli');

describe('cli-args', () => {
    let mockExit;
    beforeAll(() => {
        mockExit = mockProcessExit(new Error('process exit was called'));
    });
    afterAll(() => {
        mockExit.mockRestore();
    });

    test.each([
        [ 
            'run cmd: explicit', 
            ['-p', 'app', 'run', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', cmd_args: ['npm', '--init']} 
        ],
        [ 
            'run cmd: explicit + options', 
            ['-p', 'app', 'run', '-s', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', use_shell: true, cmd_args: ['npm', '--init']} 
        ],
        [ 
            'run cmd: explicit + options 2', 
            ['-p', 'app', 'run', '-s', '--out', 'file.env', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', use_shell: true, out_file: 'file.env', cmd_args: ['npm', '--init']} 
        ],
        [ 
            'run cmd: explicit + options before cmd', 
            ['-p', 'app', '-s', 'run', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', use_shell: true, cmd_args: ['npm', '--init']} 
        ],
        [ 
            'run cmd: explicit + options 2 before cmd', 
            ['-p', 'app', '-s', '--out', 'file.env', 'run', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', use_shell: true, out_file: 'file.env', cmd_args: ['npm', '--init']} 
        ],

        [
            'run cmd: implicit',
            ['-p', 'app', 'npm', '--init'],
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', cmd_args: ['npm', '--init'] }
        ],
        [ 
            'run cmd: implicit + options', 
            ['-p', 'app', '-s', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', use_shell: true, cmd_args: ['npm', '--init']} 
        ],
        [ 
            'run cmd: implicit + options 2', 
            ['-p', 'app', '-s', '--out', 'file.env', 'npm', '--init'], 
            { cmd: 'run', rc_file: './.envexrc', profile: 'app', use_shell: true, out_file: 'file.env', cmd_args: ['npm', '--init']} 
        ],

        [
            'get cmd',
            ['-p', 'app', 'get', 'PORT'],
            { cmd: 'get', rc_file: './.envexrc', profile: 'app', cmd_args: ['PORT'] }
        ],
        [
            'get cmd + extra args',
            ['-p', 'app', 'get', 'PORT', 'HOST'],
            { cmd: 'get', rc_file: './.envexrc', profile: 'app', cmd_args: ['PORT'] }
        ],
    ])('%s', (_name, cli_args, expected_parsed) => {
        const parsed = processArgs(cli_args);
        expect(parsed).toEqual(expected_parsed);
    });
    
    test('--profile required', () => {
        const restoreEnv = mockedEnv({ 'npm_lifecycle_event': '' });
        const restoreConsole = mockConsole('error');
        try {
            expect(() => processArgs([])).toThrow('process exit was called');
            // eslint-disable-next-line no-console
            expect(console.error).toHaveBeenCalled();
        } finally {
            restoreConsole();
            restoreEnv();
        }
    });

    test('--profile explict under npm', () => {
        const restoreEnv = mockedEnv({ 'npm_lifecycle_event': 'start' });
        try {
            const parsed = processArgs([]);
            expect(parsed).toEqual({ 
                cmd: 'run',
                rc_file: './.envexrc',
                profile: 'npm:start',
                cmd_args: []
            });
        } finally {
            restoreEnv();
        }
    });
});
