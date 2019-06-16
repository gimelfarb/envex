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

```bash
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
        'PORT': '$(npx -q get-port-cli)',
      },
      expose: {
        // react-scripts outputs the app URL to stdout, and we can
        // intercept that, to expose a value to other tools (e.g. debugger)
        'PORT': {
          regex: /https?:\/\/[^:]+:([0-9]+)/mi
        }
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
3. `envex` will resolve "PORT" env variable to a local free port, and launch `react-scripts start`
4. When `react-scripts start` outputs app URL to the stdout, `envex` will start a local service exposing the "PORT" value (service is local only, it uses *nix domain sockets or Windows pipes)

One can query the exposed value, while app is running - for example, while launching debugger or browser:

```bash
# Running in the project root folder
$ envex -p npm:start --get PORT
```

Expose configuration is optional - it is just shown here for illustration purposes.

## Features

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
