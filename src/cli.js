/* eslint-disable no-console */
const commander = require('commander');
const pjson = require('../package.json');
const { Envex } = require('./envex');

module.exports = {
    execAsync,
    processArgs,
};

async function execAsync(args, stdout) {
    stdout = stdout || process.stdout;

    const runCfg = processArgs(args);
    const { 
        profile, 
        rc_file, 
        cmd, 
        cmd_args, 
        out_file,
        out_overwrite,
        use_shell
    } = runCfg;

    let code = 0, signal;
    
    const envex = new Envex();
    await envex.loadConfig(rc_file);
    await envex.selectProfile(profile);

    envex.useStdOut(stdout);

    if (cmd === 'run') {
        await envex.resolveEnv({ ...process.env, 'FORCE_COLOR': '1' });
        if (out_file) {
            await envex.attachExpose('file', out_file, out_overwrite);
        }
        if (cmd_args.length > 0) {
            const [child_cmd, ...child_args] = cmd_args;
            await envex.attachExpose('server');
            use_shell && envex.useShell(true);
            ({ code, signal } = await envex.runCmd(child_cmd, child_args));
        } else {
            await envex.runExpose();
        }
    }
    else if (cmd === 'get') {
        const [ key ] = cmd_args;
        const val = await envex.getRemoteVar(key);
        stdout.write(val);
        stdout.write('\n');
    }

    return { code, signal };
}

function processArgs(args) {
    const opts = {
        cmd: 'run',
        cmd_args: []
    };
    const default_profile = process.env.npm_lifecycle_event ?
        `npm:${process.env.npm_lifecycle_event}` : undefined;

    // TODO: add a '--wait' switch for 'get' command, for waiting scenarios
    const program = new commander.Command();
    program
        .version(pjson.version)
        .option('-f, --rc-file <path>', 'path to the .envexrc.js config file (default: current folder)', './.envexrc')
        .option('-p, --profile <name>', 'profile name to match in the config (autoset to npm:<script> if running under npm)', default_profile);

    program
        .command('run [childcmd...]')
        .description('run child cmd under specified environment (*default command)')
        .option('-s, --shell', 'use system shell for the child command')
        .option('--out <filepath>', 'write exposed vars to the specified file after execution')
        .option('-w, --overwrite', 'overwrite output file, if already exists (default: error, if exists)')
        .action((cmd_args, cmd_opts) => {
            opts.cmd = 'run';
            opts.cmd_args = cmd_args;
            if (cmd_opts['shell']) opts.use_shell = true;
            if (cmd_opts['out']) opts.out_file = cmd_opts['out'];
            if (cmd_opts['overwrite']) opts.out_overwrite = true;
        });

    program
        .command('get <key>')
        .description('get var exposed by another process under envex')
        .action((key) => {
            opts.cmd = 'get';
            opts.cmd_args = [ key ];
        });

    // Override to allow specifying command options before
    // the command (e.g. envex -p app --use-shell run ...)
    const _originalOptionFor = program.optionFor;
    for (const cmd of program.commands) {
        for (let i = 0; i < cmd.options.length; ++i) {
            const opt = cmd.options[i];
            const evtname = 'option:' + opt.name();
            program.removeAllListeners(evtname);
            program.on(evtname, (...args) => cmd.emit(evtname, ...args));
        }
    }
    program.optionFor = (arg) => {
        let option = _originalOptionFor.apply(program, [arg]);
        if (!option) {
            for (const cmd of program.commands) {
                option = cmd.optionFor(arg);
                if (option) break;
            }
        }
        return option;
    };

    let argv = ['node', 'envex.js', ...args];
    argv = separateChildArgs(argv, 'run', program);
    program.parse(argv);

    opts.rc_file = program['rcFile'];
    opts.profile = program['profile'];

    if (!opts.profile) {
        console.error('error: option \'--profile|-p\' is required');
        process.exit(1);
    }

    return opts;
}

/**
 * Inserts '--' after all known options, to clearly
 * indicate that any following args are for the child process.
 */
function separateChildArgs(raw_argv, default_cmd, program) {
    const argv = [...raw_argv];
    let i, have_command = false;
    for (i = 2; i < argv.length; ++i) {
        const arg = argv[i];
        // If already has explicit break, then stop
        if (arg === '--') break;
        // Keep iterating over '-x' or '--xxx' options
        if (arg.length > 0 && arg[0] === '-') {
            // Use commander definition to check if option is
            // followed by a value argument
            const option = program.optionFor(arg);
            if (option) {
                if (option.required || option.optional) ++i;
            } else if (i < argv.length - 1 && argv[i + 1][0] !== '-') {
                ++i;
            }
        } else if (program.listeners('command:' + arg).length) {
            // If known command, then we can still have command-specific options
            have_command = true;
            continue;
        } else {
            // Otherwise the options are finished, and the rest is
            // a child command
            argv.splice(i, 0, '--');
            break;
        }
    }
    // Check if we need to insert the default command
    if (!have_command) {
        argv.splice(i, 0, default_cmd);
    }
    return argv;
}