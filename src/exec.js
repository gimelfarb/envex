const spawn = require('cross-spawn');

module.exports = {
    runChildAsync,
};

async function runChildAsync(cmd, args, opts) {
    let { stdio, env, cwd, shell } = opts || {};
    stdio = stdio || {};

    const stdioNames = ['stdin', 'stdout', 'stderr'];
    const stdioFlag = (name) => {
        if (stdio === 'inherit') return 'inherit';
        if (stdio[name] === 'inherit') return 'inherit';
        if (typeof stdio[name] === 'function') return 'pipe';
        return 'ignore';
    };

    const child = spawn(cmd, args, {
        stdio: stdioNames.map(stdioFlag),
        env: { ...process.env, ...env },
        cwd,
        shell
    });

    const child_promise = new Promise((resolve, reject) => {
        const completion = (code, signal) => signal ? resolve({code, signal}) : resolve({code});

        const termSignals = ['SIGINT','SIGTERM','SIGHUP'];
        const termListener = (signal, code) => {
            restoreTermHandling();
            child.kill(signal);
            completion(code, signal);
        };

        const restoreTermHandling = () => termSignals.forEach(signal => process.removeListener(signal, termListener));
        termSignals.forEach(signal => process.on(signal, termListener));

        process.on('exit', (code, signal) => {
            restoreTermHandling();
            child.kill('SIGTERM');
            completion(code, signal);
        });

        child.on('error', (err) => reject(err));
        child.on('exit', (code, signal) => {
            restoreTermHandling();
            completion(code, signal);
        });
    });

    stdioNames.forEach(name => {
        const tapfn = stdio[name];
        if (typeof tapfn === 'function') tapfn(child[name]);
    });

    return child_promise;
}
