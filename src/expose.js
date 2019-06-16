const ipc = require('./ipc');

module.exports = {
    startExposingAsync,
    connectRemoteAsync,
};

async function startExposingAsync(srvname) {
    const exposed = {};
    const server = await ipc.startServerAsync(srvname, (req, cb) => {
        const { name, args } = req;
        switch (name) {
            case 'getvar':
                {
                    const { key } = args;
                    const val = exposed[key];
                    cb(null, { key, val });
                }
                return;
        }
        cb(new Error('unknown request: ' + name));
    });

    return {
        set(name, val) {
            exposed[name] = val;
        },
        close() {
            server.close();
        }
    };
}

async function connectRemoteAsync(srvname) {
    const client = await ipc.connectRemoteAsync(srvname);
    return {
        async getAsync(key) {
            const res = await client.sendAsync('getvar', { key });
            return res.val;
        },
        disconnect() {
            client.disconnect();
        }
    };
}
