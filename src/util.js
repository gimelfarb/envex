module.exports = {
    Deferred,
    streamToString,
    once
};

function Deferred() {
    /* A method to resolve the associated Promise with the value passed.
    * If the promise is already settled it does nothing.
    *
    * @param {anything} value : This value is used to resolve the promise
    * If the value is a Promise then the associated promise assumes the state
    * of Promise passed as value.
    */
    this.resolve = null;

    /* A method to reject the assocaited Promise with the value passed.
    * If the promise is already settled it does nothing.
    *
    * @param {anything} reason: The reason for the rejection of the Promise.
    * Generally its an Error object. If however a Promise is passed, then the Promise
    * itself will be the reason for rejection no matter the state of the Promise.
    */
    this.reject = null;

    /* A newly created Promise object.
    * Initially in pending state.
    */
    this.promise = new Promise(function(resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
    }.bind(this));
    Object.freeze(this);
}

// https://stackoverflow.com/a/49428486/604316
function streamToString (stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    });
}

// Copied from Node.js source: https://github.com/nodejs/node/blob/01b404f629d91af8a720c51e90895bf0c07b0d6d/lib/events.js#L487
// (Since it is only available in Node v11.x, and we want to support lower versions)
function once(emitter, name) {
    return new Promise((resolve, reject) => {
      const eventListener = (...args) => {
        if (errorListener !== undefined) {
          emitter.removeListener('error', errorListener);
        }
        resolve(args);
      };
      let errorListener;
  
      // Adding an error listener is not optional because
      // if an error is thrown on an event emitter we cannot
      // guarantee that the actual event we are waiting will
      // be fired. The result could be a silent way to create
      // memory or file descriptor leaks, which is something
      // we should avoid.
      if (name !== 'error') {
        errorListener = (err) => {
          emitter.removeListener(name, eventListener);
          reject(err);
        };
  
        emitter.once('error', errorListener);
      }
  
      emitter.once(name, eventListener);
    });
  }
