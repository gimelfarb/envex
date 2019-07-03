module.exports = async () => ({
    profiles: {
        'npm:start': {
            env: {
                // Dynamic PORT using get-port-cli command-line utility
                'PORT': '$(npx -q get-port-cli)',
                // Here we point react-scripts to use ".launchgen.js" script
                'BROWSER': '.launchgen.js',
                // Following is only needed because we have this nested inside the root
                // project, and there are incompatible versions of 'jest', which
                // react-scripts will complain about
                'SKIP_PREFLIGHT_CHECK': 'true'
            },
            expose: {
                // react-scripts outputs the app URL to stdout, and we can
                // intercept that, to expose a value to other tools (see below)
                'PORT': {
                    regex: /https?:\/\/[^:]+:([0-9]+)/mi
                }
            }
        },
        // 'launchgen' profile will be used by the JS script pointed to
        // by BROWSER env variable passed to 'react-scripts'
        'launchgen': {
            env: {
                // Retrieve PORT value exposed by envex from 'npm:start' profile
                // when running 'react-scripts start'
                'PORT': '$(envex -p npm:start get PORT)',
                // URL is needed for 'dot-launch' utility
                'URL': 'http://localhost:${PORT}/'
            }
        }
    }
});
