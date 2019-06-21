const path = require('path');
const fs = require('fs');
const { readEnvFileAsync } = require('./persist');

module.exports = {
    loadConfigAsync,
    createConfigResolver,
};

// TODO: support load .env files (for compatibility with existing setups)

async function loadConfigAsync(potentialPath) {
    const configPath = await findConfigFileAsync(potentialPath);
    if (!configPath) {
        throw new Error('Unable to find a valid envex config file');
    }

    let { ext } = path.parse(configPath);
    let rawConfig;
    if (ext === '.js') {
        rawConfig = await loadConfigAsModuleAsync(configPath);
    } else if (ext === '.json') {
        rawConfig = await loadConfigAsJsonAsync(configPath);
    } else {
        throw new Error('Unknown config file extension: ' + configPath);
    }

    return createConfigResolver(rawConfig);
}

function createConfigResolver(rawConfig) {
    const rawProfiles = rawConfig.profiles || {};
    const resolvedProfiles = {};
    const _profile = async (name, resolvingProfiles) => {
        if (!resolvedProfiles[name]) {
            const rawProfile = rawProfiles[name];
            if (!rawProfile) throw new Error(`Unknown profile: ${name}`);

            if (resolvingProfiles[name]) throw new Error(`Circular reference for profile: ${name}`);
            resolvingProfiles[name] = true;
            try {
                const recursiveConfig = { profile: (name) => _profile(name, resolvingProfiles) };
                const resolved = await resolveProfileConfigAsync(rawProfile, recursiveConfig);
                resolvedProfiles[name] = resolved;
            } finally {
                resolvingProfiles[name] = false;
            }
        }
        return resolvedProfiles[name];
    };
    const config = {
        async profile(name) {
            return _profile(name, {});
        }
    };
    return config;
}

//////////////////////    RESOLVE      /////////////////////////

async function resolveProfileConfigAsync(rawProfile, config) {
    let { imports, profile: extend, ...profile } = rawProfile;

    if (typeof extend === 'string') extend = [ extend ];
    else if (!Array.isArray(extend)) extend = [];

    let base = {};
    for (const name of extend) {
        const extent = await config.profile(name);
        base = extendProfileConfig(base, extent);
    }

    if (typeof imports === 'string') imports = [ imports ];
    else if (!Array.isArray(imports)) imports = [];

    for (const name of imports) {
        // FIX TODO: file resolution needs to be relative to config file
        const env = await readEnvFileAsync(name);
        base = extendProfileConfig(base, { env });
    }

    profile = extendProfileConfig(base, profile);
    return profile;
}

function extendProfileConfig(base, extent) {
    let copy;
    if (extent.env) {
        copy = copy || { ...base };
        if (!Array.isArray(copy.env)) {
            copy.env = copy.env ? [ copy.env ] : [];
        }
        copy.env.push(extent.env);
    }
    if (extent.expose) {
        copy = copy || { ...base };
        if (!Array.isArray(copy.expose)) {
            copy.expose = copy.expose ? [ copy.expose ] : [];
        }
        copy.expose.push(extent.expose);
    }
    if (extent.cwd) {
        copy = copy || { ...base };
        copy.cwd = extent.cwd;
    }
    return copy || base;
}

///////////////////      LOADING      /////////////////////

async function findConfigFileAsync(potentialPath) {
    let stats = await statSafeAsync(potentialPath);

    let { dir, base, ext } = path.parse(path.resolve(potentialPath));
    if (stats && stats.isDirectory() && base) {
        dir = path.join(dir, base, ext);
        base = ext = '';
    }

    base = base || '.envexrc';
    const exts = ext ? [ext] : ['.js', '.json'];

    const check = exts.map(ext => path.join(dir, base + ext));
    for (const checkpath of check) {
        const checkstats = await statSafeAsync(checkpath);
        if (checkstats && checkstats.isFile()) return checkpath;
    }
}

async function loadConfigAsModuleAsync(configPath) {
    const config = require(configPath);
    if (typeof config === 'function') {
        const result = config();
        return Promise.resolve(result);
    }
    return config;
}

async function loadConfigAsJsonAsync(configPath) {
    const config = require(configPath);
    return config;
}

function statSafeAsync(pathstr) {
    return new Promise((resolve, reject) => {
        fs.stat(pathstr, (err, stats) => {
            if (err) {
                return (err.code === 'ENOENT') 
                    ? resolve(null) : reject(err);
            }
            resolve(stats);
        });
    });
}
