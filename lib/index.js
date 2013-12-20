/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var http = require('http'),
    https = require('https'),
    requestID = 0,
    consoleError = console.error;

/*
 * Helper function that will add the PID and request information to the log. 
 * Keep track of an index for the request as to not pollute the log
 */
function addPrefix(output, args, displayURL) {
    if (process.hasOwnProperty('__request')) {
        var request = process.__request;
        if (request) {
            if (!request.hasOwnProperty('__requestID')) {
                requestID = requestID % 1e8;
                request.__requestID = ++requestID;
            }
            if (request.method &&
                    (displayURL || !request.hasOwnProperty('__firstOutput'))) {
                request.__firstOutput = 1;
                output.apply(this, [['[', process.pid, ':',
                    request.__requestID, '] Method: ', request.method,
                    '  - url: ', (request.url || request.path)].join('')]);
            }
            if (args) {
                args[0] = ['[', process.pid, ':',
                    request.__requestID, '] ',
                    args[0]].join('');
            }
        }
    }
    return args;
}

// console.log override
(function (log) {
    console.log = function () {
        return log.apply(this, addPrefix(log, arguments));
    };
}(console.log));

// console.error override
(function (error) {
    console.error = function () {
        return error.apply(this, addPrefix(error, arguments));
    };
}(console.error));

// Capturing request in nextTick
(function (nextTick) {
    process.nextTick = function (callback) {
        var request = process.__request;
        nextTick.call(this, function () {
            var rc, prevRequest = process.__request;
            process.__request = request;
            rc = callback.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        });
    };
}(process.nextTick));

// Capturing request in setTimeout
(function (timeout) {
    global.setTimeout = function (f, t) {
        var request = process.__request;
        return timeout.apply(this, [function () {
            var rc, prevRequest = process.__request;
            process.__request = request;
            rc = f.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        }, t]);
    };
}(global.setTimeout));

// Capturing request in setInterval
(function (interval) {
    global.setInterval = function (f, t) {
        var request = process.__request;
        return interval.apply(this, [function () {
            var rc, prevRequest = process.__request;
            process.__request = request;
            rc = f.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        }, t]);
    };
}(global.setInterval));

// Capturing request in http.request
(function (httpRequest) {
    http.request = function (options, cb) {
        if (!cb) {
            return httpRequest.apply(this, arguments);
        }
        return httpRequest.apply(this, [options, function (response) {
            var rc, prevRequest = process.__request;
            process.__request = { method: options.method, url: options.path };
            rc = cb.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        }]);
    };
}(http.request));

// Capturing request in http.get
(function (httpGet) {
    http.get = function (options, cb) {
        if (!cb) {
            return httpGet.apply(this, arguments);
        }
        return httpGet.apply(this, [options, function (response) {
            var rc, prevRequest = process.__request;
            process.__request = { method: options.method, url: options.url };
            rc = cb.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        }]);
    };
}(http.get));

// Capturing request in https.request
(function (httpsRequest) {
    https.request = function (options, cb) {
        if (!cb) {
            return httpsRequest.apply(this, arguments);
        }
        return httpsRequest.apply(this, [options, function (response) {
            var rc, prevRequest = process.__request;
            process.__request = { method: options.method, url: options.path };
            rc = cb.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        }]);
    };
}(https.request));

// Capturing request in https.get
(function (httpsGet) {
    https.get = function (options, cb) {
        if (!cb) {
            return httpsGet.apply(this, arguments);
        }
        return httpsGet.apply(this, [options, function (response) {
            var rc, prevRequest = process.__request;
            process.__request = { method: options.method, url: options.path };
            rc = cb.apply(this, arguments);
            process.__request = prevRequest;
            return rc;
        }]);
    };
}(https.get));

// Capturing request in http.emit
(function (httpEmit) {
    http.Server.prototype.emit = function (name, request, response) {
        var rc, prevRequest = process.__request;
        if (this instanceof http.Server && name === 'request') {
            process.__request = request;
        }
        rc = httpEmit.apply(this, arguments);
        process.__request = prevRequest;
        return rc;
    };
}(http.Server.prototype.emit));

// Capturing request in https.emit
(function (httpsEmit) {
    https.Server.prototype.emit = function (name, request, response) {
        var rc, prevRequest = process.__request;
        if (this instanceof https.Server && name === 'request') {
            process.__request = request;
        }
        rc = httpsEmit.apply(this, arguments);
        process.__request = prevRequest;
        return rc;
    };
}(https.Server.prototype.emit));

// Adds PID and request information on fatal exceptions
(function (processFatal) {
    process._fatalException = function () {
        addPrefix(console.error, [], true);
        return processFatal.apply(this, arguments);
    };
}(process._fatalException));

// Adds PID and request information on process emit
(function (processEmit) {
    process.emit = function (event) {
        if (event === 'uncaughtException') {
            addPrefix(consoleError, [], true);
        }
        return processEmit.apply(this, arguments);
    };
}(process.emit));

/*
 * Helper function to add request information for async methods
 */
function wrapAsyncFuncs(moduleName, funcs) {
    var mod = require(moduleName);
    funcs.forEach(function (funcName) {
        (function (orgCallback) {
            mod[funcName] = function () {
                var request = process.__request,
                    index,
                    callback,
                    args = [];
                for (index in arguments) {
                    if (arguments.hasOwnProperty(index)) {
                        callback = arguments[index];
                        if (typeof callback === 'function') {
                            orgCallback.apply(this, args.concat(function () {
                                var rc, prevRequest = process.__request;
                                process.__request = request;
                                rc = callback.apply(this, arguments);
                                process.__request = prevRequest;
                                return rc;
                            }));
                        } else {
                            args.push(arguments[index]);
                        }
                    }
                }
            };
        }(mod[funcName]));
    });
}

// List of async methods
var asyncFuncs = {
    'fs': [
        'rename',     'truncate',  'chown',       'fchown',
        'lchown',     'chmod',     'fchmod',      'lchmod',
        'stat',       'lstat',     'fstat',       'link',
        'symlink',    'readlink',  'realpath',    'unlink',
        'rmdir',      'mkdir',     'readdir',     'close',
        'open',       'utimes',    'futimes',     'fsync',
        'write',      'read',      'readFile',    'writeFile',
        'appendFile', 'watchFile', 'unwatchFile', 'watch',
        'exists'
    ]
};

wrapAsyncFuncs('fs', asyncFuncs.fs);

// Making sure the uncaught exception has at least one listener, otherwise the
// process.emit for it is never called
process.on('uncaughtException', function (err) {
    if (process._events.uncaughtException &&
            process._events.uncaughtException.length < 2) {
        addPrefix(consoleError, [err.stack], true);
        process.exit(1);
    }
});

module.exports = function () {
    return function (request, response, next) {
        var rc, prevRequest = process.__request;
        process.__request = request;
        rc = next();
        process.__request = prevRequest;
        return rc;
    };
};
