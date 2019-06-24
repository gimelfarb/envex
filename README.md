# envex 
[![Build Status][travis-badge]][travis-href] [![Coverage Status][codecov-badge]][codecov-href] [![Semantic Versioning][semrel-badge]][semrel-href]

[travis-href]: https://travis-ci.org/gimelfarb/envex
[codecov-href]: https://codecov.io/gh/gimelfarb/envex
[semrel-href]: https://github.com/semantic-release/semantic-release

[travis-badge]: https://img.shields.io/travis/gimelfarb/envex/master.svg
[codecov-badge]: https://img.shields.io/codecov/c/gh/gimelfarb/envex.svg
[semrel-badge]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg

Most flexible management of your environment variables configuration. Not limited to plain static values, variable values can be a result of an async function call at run-time, or bash-style command expansion $(...), allowing for some advanced scenarios. What's more, values can be extracted from command text output (e.g. dynamic ports, URLs, file paths, etc), and exposed locally to other processes running through Envex, creating powerful orchestrations.

Checkout examples below to explore how `envex` can be useful in any development workflow.

**WARNING**: *Under active development - this is still alpha quality, use at your own risk!*

## Motivation

Modern frontend and backend development workflows include a myriad of tools (e.g. TypeScript, ESLint, Babel, Webpack, SCSS, Docker, DB migrators, etc). Not only do we want to be able to express environment variables for the application being built, but also for the various tools used to launch various parts of the build process and test environments (e.g. setting up isolated Docker environment for testing, running migrations on the DB, running e2e and unit tests, etc).

While it has been a standard practice to create dot-env (`.env`) files to specify environment variables, there is always an issue with not being able to commit sensitive variables to source control. Each developer must maintain a local file, but there aren't any elegant ways of expressing what those variables are (other than documentation). When a new developer first clones the project, it is not obvious how to setup local environment. Plus, there is a lack of consistency in how the `.env` files are supported among various tools.

Most projects tend to hard-code certain values for developer environment - port numbers, local DB password, token encryption keys, social login app identifiers - due to difficulty in making them dynamic (i.e. this helps a developer to bootstrap a local environment quickly). But it is not ideal that everyone has the same password for a local DB. Nor is it ideal to hardcode port numbers, especially if developing multiple projects at the same time, risking collision.

`envex` was born to solve an array of complex problems associated with managing environment variables in a development environment. While a smooth development workflow was the primary goal, there's nothing preventing `envex` from being used in production scenarios as well.

## Getting Started

### Installation

At a minimum, install the package:

```bash
$ npm i --save-dev envex
```

### Usage

Create `.envexrc.js` configuration file, then use it from command-line to set environment:

```bash
$ envex -p app node index.js
```

## Examples

### Dynamic Port for React App

Most React apps are created using [create-react-app](https://github.com/facebook/create-react-app) command line. This means that `npm start` will, by default, start your app on port 3000 (and watch for source changes to refresh the app). You only need to develop a few projects like that to start running into port collision issues.

We will extend this setup with `envex` to guarantee that every developer will start the app on a free port locally. Let's create the initial React CRA app:

```
$ mkdir cra-random-port && cd $_
$ npx create-react-app . --use-npm
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

### Dynamic Port for React App - Part 2

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
        'PORT': '$(envex -p npm:start --get PORT)',
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
5. `envex` 'launchgen' profile will retrieve exposed PORT value (i.e. `$(envex -p npm:start --get PORT)`), and set the  `URL` env variable to the correct dynamic app URL (to be used by `dot-launch`)
6. `dot-launch` generates an HTML launch file `.launch/app.html` using the specified `URL` (it is a page which automatically redirects to that URL when opened in browser)
7. VSCode opens Chrome in debug mode, and uses "launch file" which redirects to the generated app URL!

### Random password for a local dev PostgreSQL DB instance

We are going to use Docker to run a local dev DB instance, to be used as a persistence for our backend API app. Let's create a Docker Compose configuration to launch it:

```yml
# File: docker-compose.yml
version: '3'

services:
  db:
    image: postgres
    restart: always
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      # Make sure that data stays persistent by mapping PostgreSQL data folder
      # to a local folder ./postgres-data. Make sure to add it to your .gitignore!
      - ./postgres-data:/var/lib/postgresql/data
    ports:
      - "5432"
```

As you can see, we are not hard-coding the admin password, but letting it be configured through environment variable `POSTGRES_PASSWORD`. Let's create `.envexrc.js` configuration:

```javascript
// File: .envexrc.js
const shortuuid = require('shortuuid');

module.exports = {
  profiles: {
    'init:local': {
      // Generate random password to be used for the local database.
      // We only want to do this once, when developer first clones the repo,
      // so this profile is invoked when 'npm install' is first run.
      expose: {
        'POSTGRES_PASSWORD': () => shortuuid.generate()
      }
    },
    'db:build:local': {
      // Generated values will be written to a file .env.local, which we
      // can import here, to use a consistent POSTGRES_PASSWORD value
      imports: ['.env.local'],
      env: {
        // We'll mark it as required, so that it fails if it is ever not
        // specified
        'POSTGRES_PASSWORD': { required: true },
        // Here we can also customise the Docker Compose project name,
        // so that we don't have to specify on the command-line
        'COMPOSE_PROJECT_NAME': 'sample-app-backend'
      }
    }
  }
};
```

Make sure to install the package `shortuuid` that was used to create a random password:

```bash
$ npm i -D shortuuid
```

Now, let's create modify npm scripts in `package.json` to use these:

```json
// File: package.json
{
  "scripts": {
    "prepare": "npm run prepare:dev",
    "prepare:dev": "envex -p init:local --out .env.local",
    "start:db:dev": "envex -p db:build:local docker-compose up db"
  }
}
```

Note: you'll want to make sure that `.env.local` is added to your `.gitignore`.

Following is the intended workflow:

1. Developer clones the repo, and runs `npm i` locally, which causes npm `prepare` script to run ([see here](https://docs.npmjs.com/misc/scripts))
2. `prepare:dev` executes, and, using `init:local` profile of the `envex` configuration, will write out auto-generated `POSTGRES_PASSWORD` value to a `.env.local` file
3. When ready to run/debug application locally, developer runs `npm run start:db:dev`, which uses `db:build:local` profile and reads `POSTGRES_PASSWORD` value from `.env.local` file before invoking `docker-compose` to start the DB container instance

### Using random Docker Compose instance ports

Following on from the example above, you'll notice that we never specifed the host port mapping in the `docker-compose.yml` configuration for the `db` container. This means that the local DB container will assign a random free port on the host, and map it to container's port `5432`. How do we use it?

Well, Docker Compose allows us to know what the mapping is, via `docker-compose port db 5432` command, which returns the local hostname plus bound port combination. 

We'll configure our backend app to use it automatically with `envex`! Let's add another profile to the `envexrc.js` configuration:

```javascript
// File: .envexrc.js
// ...
module.exports = {
  profiles: {
    // ...
    'app:local': {
      imports: ['.env.local'],
      env: {
        // Using "db:build:local" profile, launch 'docker-compose' to find out currently
        // mapped local host:port combination for the running 'db' container
        'POSTGRES_HOSTNAME': '$([db:build:local] docker-compose port db 5432)',
        // Use POSTGRES_HOSTNAME and POSTGRES_PASSWORD (from .env.local) to create a
        // connection string for the DB, to use in the app
        'DATABASE_URL': 'postgres://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOSTNAME}/postgres',
      }
    }
  }
};
```

We'll add another script to `package.json`:

```json
// File: package.json
{
  "scripts": {
    // ...
    "start:dev": "envex -p app:local node index.js"
  }
}
```

Now, running `npm run start:dev` will start our backend app with the correct `DATABASE_URL` environment variable. Application code can simply use `DATABASE_URL` environment variable to connect to the database, and in Production this will be set appropriately based on the setup (e.g. Heroku sets this automatically).

## Features

TODO

## Reference

### CLI

```
$ envex --help
Usage: envex [options] [childcmd...]

Options:
  -V, --version         output the version number
  -f, --rc-file <path>  path to the .envexrc.js config file (default: current folder) (default: "./.envexrc")
  -p, --profile <name>  profile name to match in the config (autoset to npm:<script> if running under npm)
  -s, --shell           use system shell for the child command
  --get <key>           get var exposed by another process under envex
  --out <filepath>      write exposed vars to the specified file after execution
  -h, --help            output usage information
```

- `-f, --rc-file <path>` - allows overriding the config file path (by default looks for `.envexrc.js` or `.envexrc.json` in the current working dir)
- `-p, --profile <name>` - specifies the profile name to use, and must match one of the profile names from the configuration file (if running through npm scripts, this will default to `npm:<script>`, e.g. `npm:start`)
- `-s, --shell` - uses system shell to run the child command, which is useful if you are using multiple commands separated by `&&` (e.g. `docker-compose kill && docker-compose rm -f`)
- `--out <filepath>` - writes all variables declared in 'expose' section to a file, in a dot-env (`.env`) format; these can later be used to import into other envex profiles through `imports` config

### Configuration

Configuration can be either `.js` module or `.json` file. Only `.js` version supports advanced features like using async functions. However, `.json` can be sufficient in simpler scenarios.

Also available as a [TypeScript definition](./index.d.ts).

For `.envexrc.js` it is a CommonJS (i.e. Node-style) module exporting configuration:

```javascript
// directly export JS configuration object
module.exports = { ... };
// use an async/sync function to return a JS configuration object
module.exports = async () => ({ ... });
```

Configuration object:

```javascript
module.exports = {
  // Defines profiles to be referenced from command-line (e.g. envex -p name ...)
  profiles: {
    'name': {
      // Optionally inherit other profile(s), and extend. Can be useful for
      // defining base profiles (e.g. app required env variables), to avoid copy-paste.
      profile: 'other' || ['other'],
      // Import env variable definitions from dot-env (.env) style files. Useful to
      // combine with writing out generated variables once, and then importing them
      // in other profiles when launching the app.
      imports: 'filepath' || ['filepath'],
      // Set current working directory for the launched command. Paths are relative to
      // the config file's folder
      cwd: 'folderpath',
      // Defines environment variables for the launched command
      // Can be:
      // - array of env configs (map/function/string), each processed in turn, and merged
      env: [
        { 'KEY': 'val' }
      ],
      // - function which returns env name/value map, or Promise
      env: async () => ({ 'KEY': 'val' }),
      // - map of env variable names to value definition
      env: {
        // Full definition for env variable
        'KEY': {
          // Optional flag - whether env var is required. If value does
          // not exist at run-time, envex will fail with non-zero exit code.
          // Default: true
          required: true,
          // Optional flag - whether value should be overridden, even if
          // already exists in parent env (by default, env vars are not overridden)
          // Default: false
          override: false,
          // Value string - resolved using ${} and $() expansions
          value: 'val',
          // Can also be a function returning string or Promise
          // ctx.env - parent environment vars
          // ctx.has(name) - returns if name is already defined
          // ctx.resolve(str) - resolves value string, including ${} and $() expansions
          value: (ctx) => 'val'
        },
        // Short-hand for { 'KEY': { value: 'val' }}
        'KEY': 'val',
        // Short-hand for { 'KEY': { value: (ctx) => ctx.resolve('${key}') } }
        'KEY': (ctx) => ctx.resolve('${key}')
      },
      // - short-hand to declare a required env variable 
      env: [
        // Equivalent to { 'KEY': { required: true } }
        'KEY',
        // Equivalent to { 'KEY': { required: false } }
        '[KEY]' || 'KEY?',
        // Equivalent to { 'KEY': { override: true } }
        'KEY!'
      ],
      // Defines variables to 'expose' (for other tools, or write to .env file with --out flag)
      // Can be:
      // - array of expose configs, each processed in turn
      expose: [
        { 'KEY': 'val' },
        () => { 'KEY': 'val' }
      ],
      // - function which returns expose name/value map, or Promise
      //   ctx.env - resolved env key/value map
      expose: async (ctx) => ({ 'KEY': ctx.env['KEY'] }),
      // - function which uses expose callback to return name/value map
      //   ctx.env - resolved env key/value map
      //   ctx.tap - readable stream of launched command stdout/stderr (can parse and call expose cb)
      expose: async (ctx, expose) => {
        ctx.tap.on('data', () => {
          expose({ 'KEY': 'val' })
        });
      },
      // - map exposed keys to values
      expose: {
        // Extract value from the command's stdout/stderr, by applying a regex pattern.
        // Value of the 1st capture group (i.e. in brackets) is used.
        'KEY': {
          regex: 'pattern'
        },
        // Explicit string value
        'KEY': 'val',
        // Value or Promise returned by function
        'KEY': (ctx) => 'val',
        // Value exposed by invoking a callback
        'KEY': (ctx, expose) => expose('val')
      },
      // When array of strings, it is equivalent to exposing value
      // of the same-named environment variable
      expose: [
        // equivalent to { 'KEY': (ctx) => ctx.env['KEY'] }
        'KEY'
      ]
    }
  }
}
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](../../tags). 

## Authors

* **Lev Gimelfarb** - *Initial work* - [@gimelfarb](https://github.com/gimelfarb)

See also the list of [contributors](https://github.com/gimelfarb/html-fiddle/contributors) who participated in this project.

## License

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* [env-cmd](https://github.com/toddbluhm/env-cmd) - 
* [cross-env](https://github.com/kentcdodds/cross-env) - 

Also, thanks [@PurpleBooth](https://github.com/PurpleBooth), for the [README template](https://gist.github.com/PurpleBooth/109311bb0361f32d87a2) you created for all of us to use!
