const commander = require('commander');
const pjson = require('../package.json');
const { Envex } = require('./envex');

exports.main = function main() {
    mainAsync().catch(err => {
        console.error('envex error: ', err);
        process.exit(-1);
    });
};

async function mainAsync() {
    const runCfg = processArgs();
    const { profile, rc_file, cmd, cmd_args, out_file } = runCfg;
    
    const envex = new Envex();
    await envex.loadConfig(rc_file);
    await envex.selectProfile(profile);

    if (cmd === 'run') {
        await envex.resolveEnv({ ...process.env, 'FORCE_COLOR': '1' });
        if (out_file) {
            // TODO: checking if file exists? overwrite flag?
            await envex.attachExpose('file', out_file);
        }
        if (cmd_args.length > 0) {
            const [child_cmd, ...child_args] = cmd_args;
            await envex.attachExpose('server');
            // TODO: support use_shell
            const { code, signal } = await envex.runCmd(child_cmd, child_args);
            signal ? process.kill(process.pid, signal) : process.exit(code);
        } else {
            await envex.runExpose();
        }
    }
    else if (cmd === 'get') {
        const [ key ] = cmd_args;
        const val = await envex.getRemoteVar(key);
        console.log(val);
    }
}

function processArgs() {
    const opts = {
        cmd: 'run',
        cmd_args: []
    };
    const default_profile = process.env.npm_lifecycle_event ?
        `npm:${process.env.npm_lifecycle_event}` : undefined;

    // TODO: make 'get' a command rather than option (need 'run' to be an implicit command)
    commander
        .version(pjson.version)
        .arguments('[childcmd...]')
        .option('-f, --rc-file <path>', 'path to the .envexrc.js config file (default: current folder)', './.envexrc')
        .option('-p, --profile <name>', 'profile name to match in the config (autoset to npm:<script> if running under npm)', default_profile)
        .option('-s, --shell', 'use system shell for the child command')
        .option('--get <key>', 'get var exposed by another process under envex')
        .option('--out <filepath>', 'write exposed vars to the specified file after execution')
        .action((cmd_args) => {
            opts.cmd_args = cmd_args;
        });

    const argv = separateChildArgs(process.argv, commander);
    commander.parse(argv);

    opts.rc_file = commander['rcFile'];
    opts.profile = commander['profile'];
    opts.use_shell = !!commander['shell'];

    if (commander['get']) {
        opts.cmd = 'get';
        opts.cmd_args = commander['get'];
    }
    if (commander['out']) {
        opts.out_file = commander['out'];
    }

    return opts;
}

/**
 * Inserts '--' after all known options, to clearly
 * indicate that any following args are for the child process.
 */
function separateChildArgs(raw_argv, commander) {
    const argv = [...raw_argv];
    for (let i = 2; i < argv.length; ++i) {
        const arg = argv[i];
        // If already has explicit break, then stop
        if (arg === '--') break;
        // Keep iterating over '-x' or '--xxx' options
        if (arg.length > 0 && arg[0] === '-') {
            // Use commander definition to check if option is
            // followed by a value argument
            const option = commander.optionFor(arg);
            if (option && (option.required || option.optional)) {
                ++i;
            } else if (i < argv.length - 1 && argv[i + 1][0] !== '-') {
                ++i;
            }
        // Otherwise the options are finished, and the rest is
        // a child command
        } else {
            argv.splice(i, 0, '--');
            break;
        }
    }
    return argv;
}