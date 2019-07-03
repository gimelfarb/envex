## Example - Dynamic Port React App

Example project showcasing the use of [`envex`](../..) to enable dynamic local port when developing a React app.

Most React apps are created using [create-react-app](https://github.com/facebook/create-react-app) command line. This means that `npm start` will, by default, start your app on port 3000 (and watch for source changes to refresh the app). You only need to develop a few projects like that to start running into port collision issues.

### Bootstrap

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app):

```
$ mkdir cra-random-port && cd $_
$ npx create-react-app . --use-npm
```

### Part 1 - Start with Dynamic Port

We will extend the app setup with `envex` to guarantee that every developer will start the app on a free port locally:

```
$ npm i -D envex
```

Let's create a file `.envexrc.js` in the project root:

```javascript
// File: .envexrc.js
module.exports = async () => ({
  profiles: {
    'npm:start': {
      env: {
        // Dynamic PORT using get-port-cli command-line utility
        'PORT': '$(npx -q get-port-cli)'
      }
    }
  }
});
```

We will modify the 'start' script in `package.json` (running through `envex`):

```json
{
  "scripts": {
    "start": "envex react-scripts start"
  }
}
```

Following will happen when you run `npm start`:

1. `envex` will locate `.envexrc.js` in the current working folder
2. `envex`, being aware it is launched by an npm script, will locate the "npm:start" profile
3. `envex` will resolve "PORT" env variable to a local free port (by running `npx -q get-port-cli`), and launch `react-scripts start`
4. `react-scripts start` will open default system browser at the correct URL for the app

### Part 2 - VSCode Debugging with Dynamic Port

We can further extend upon the previous example. We'll integrate with Visual Studio Code, so that we can launch debugging via F5. In addition, `react-scripts` has a feature where it can ask user to change the port interactively, meaning that generated `PORT` value is not always the final one used.

We'll use a [feature of `react-scripts`](https://facebook.github.io/create-react-app/docs/advanced-configuration) where `BROWSER` environment variable can be a JS script, which is invoked when URL is known, and it is about to launch a browser. Instead, we'll use that opportunity to generate an HTML "launch file", which redirects to the app URL, and which VSCode will be using to start debugging.

Let's install a `dot-launch` utility to be able to generate HTML "launch file":

```bash
$ npm i -D dot-launch
```

We'll create a JS script to be used through `BROWSER` env variable. Create a `.launchgen.js` in the project root folder:

```javascript
// File: .launchgen.js
const { execSync } = require('child_process');

try {
    // Just invoke a command-line utility to generate the "launch file" ...
    execSync('envex -p launchgen dot-launch', { stdio: 'inherit' });
    console.log('Launch file generated!');
} catch (err) {
    process.exit(err.status || -1);
}
```

By default, `dot-launch` will create a file `.launch/app.html` using the supplied URL (via `URL` env variable).

Let's modify `.envexrc.js` config:

```javascript
// File: .envexrc.js
module.exports = async () => ({
  profiles: {
    'npm:start': {
      env: {
        'PORT': '$(npx -q get-port-cli)',
        // Here we point react-scripts to use ".launchgen.js" script
        'BROWSER': '.launchgen.js'
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
```

Finally, we'll create the following VSCode launch configuration (`.vscode/launch.json` file):

```js
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "chrome",
            "request": "launch",
            "name": "Frontend",
            // Here we point to the generated launch file!
            "file": "${workspaceFolder}/.launch/app.html",
            "webRoot": "${workspaceFolder}"
        },
    ]
}
```

To start debugging, launch the debug server:

```bash
$ npm start
```

Now, you can press F5 to debug through VSCode - it will connect to the correct dynamic URL!

The sequence of steps explained:

1. `npm start` launches `react-scripts start` through `envex` 'npm:start' profile
2. `envex` 'npm:start' profile generates a free `PORT` number, and also sets `BROWSER` variable to tell `react-scripts` to run it after debug web server PORT number has been fully confirmed (*i.e. it can change interactively, if there are unlikely collisions*)
3. `envex` 'npm:start' profile also sets up a watch for URLs in stdout (using regex), and told to expose it via `PORT` exposed variable. Exposing variables means starting a local server on a Unix-style socker (pipes on Windows), which can be queries through `envex` command-line.
4. When `react-script` launch `.launchgen.js` script (via `BROWSER` setting), it will run `dot-launch` command-line utility through `envex` profile 'launchgen'
5. `envex` 'launchgen' profile will retrieve exposed PORT value (i.e. `$(envex -p npm:start get PORT)`), and set the  `URL` env variable to the correct dynamic app URL (to be used by `dot-launch`)
6. `dot-launch` generates an HTML launch file `.launch/app.html` using the specified `URL` (it is a page which automatically redirects to that URL when opened in browser)
7. VSCode opens Chrome in debug mode, and uses "launch file" which redirects to the generated app URL!
