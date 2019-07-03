const { execSync } = require('child_process');

try {
    // Just invoke a command-line utility to generate the "launch file" ...
    execSync('envex -p launchgen dot-launch', { stdio: 'inherit' });
    console.log('Launch file generated!');
} catch (err) {
    process.exit(err.status || -1);
}
