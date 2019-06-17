const ipc = require('node-ipc');

ipc.config.appspace = 'envex.';
ipc.config.maxRetries = 0;
ipc.config.stopRetrying = true;
ipc.config.silent = true;

module.exports = {
    startServerAsync,
    connectRemoteAsync,
};

function startServerAsync(srvname, handler) {
    return new Promise((resolve, reject) => {
        let connectTimeout = setTimeout(
            () => reject(new Error('server start timeout')), 
            5000);

        const clearConnectTimeout = () => {
            if (connectTimeout) {
                clearTimeout(connectTimeout);
                connectTimeout = null;
                return true;
            }
            return false;
        };
    
        ipc.config.id = srvname;
        ipc.serve(() => {
            clearConnectTimeout();
            resolve({
                close() {
                    ipc.server.stop();
                }
            });

            ipc.server.on('req', (data, socket) => {
                const { seq, name, args } = data;
                handler({ name, args }, (err, res) => {
                    if (err) {
                        ipc.server.emit(socket, 'res', { seq, name, err });
                    } else {
                        ipc.server.emit(socket, 'res', { seq, name, res });
                    }
                });
            });
        });

        ipc.server.on('error', (err) => {
            if (clearTimeout(connectTimeout)) {
                reject(err);
            }
        });
        ipc.server.start();
    });
}

function connectRemoteAsync(srvname) {
    return new Promise((resolve, reject) => {
        let connectTimeout = setTimeout(
            () => reject(new Error('client connect timeout')), 
            5000);

        const clearConnectTimeout = () => {
            if (connectTimeout) {
                clearTimeout(connectTimeout);
                connectTimeout = null;
                return true;
            }
            return false;
        };

        let pending = {};
        ipc.connectTo(srvname, () => {
            const ipcsrv = ipc.of[srvname];
            ipcsrv.on('error', (err) => {     
                if (clearConnectTimeout()) {
                    reject(err);
                }
                Object.values(pending).forEach(({reject}) => reject(err));
                pending = {};
            });
            ipcsrv.on('res', (data) => {
                const { seq, res, err } = data;
                const slot = pending[seq];
                if (slot) {
                    delete pending[seq];
                    err ? slot.reject(err) : slot.resolve(res);
                }
            });
            ipcsrv.on('connect', () => {
                clearConnectTimeout();

                let uniq = 1;
                const client = {
                    sendAsync(name, args) {
                        return new Promise((resolve, reject) => {
                            const seq = uniq++;
                            pending[seq] = { resolve, reject };
                            ipcsrv.emit('req', { seq, name, args });
                        });
                    },
                    disconnect() {
                        ipc.disconnect(srvname);
                    }
                };

                resolve(client);
            });
        });    
    });
}