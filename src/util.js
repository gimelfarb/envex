module.exports = {
    isPromiseLike,
    Deferred,
    pick,
    streamToString
};

function isPromiseLike(p) {
    return p && typeof p.then === 'function';
}

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

function pick(obj, keys) {
    if (typeof keys === 'string') keys = [keys];
    if (!Array.isArray(keys)) return {};
    return keys.reduce((acc, key) => { acc[key] = obj[key]; return acc; }, {});
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
