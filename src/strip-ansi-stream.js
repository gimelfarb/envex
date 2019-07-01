const stream = require('stream');

module.exports = stripAnsiStream;

// Based on regex from 'ansi-regex': https://github.com/chalk/ansi-regex/blob/master/index.js
const ansiRegex = (() => {
    const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
    ].join('|');
    return new RegExp(pattern, 'g');
})();

const potentialAnsiRegex = (() => {
    const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?))'
    ].join('|');
    return new RegExp(pattern, 'g');
})();

function stripAnsiStream() {
    let potentialstr;
    return new stream.Transform({
        transform(chunk, _encoding, cb) {
            let str = (potentialstr || '') + chunk.toString('utf8');
            potentialstr = null;

            let lastAnchorIdx = str.lastIndexOf('\u001b');
            if (lastAnchorIdx < 0) lastAnchorIdx = str.lastIndexOf('\u009b');
            if (lastAnchorIdx >= 0) {
                potentialstr = str.substring(lastAnchorIdx);
                if (potentialstr.match(potentialAnsiRegex)) {
                    str = str.substring(0, lastAnchorIdx);
                } else {
                    potentialstr = null;
                }
            }

            str = str.replace(ansiRegex, '');
            cb(null, str);
        },
        flush(cb) {
            potentialstr && cb(null, potentialstr);
        }
    });
}


