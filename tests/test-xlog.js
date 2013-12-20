/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
var YUITest = require('yuitest').YUITest,
    Assert = YUITest.Assert,
    suite = new YUITest.TestSuite("Unit");

YUITest.TestRunner.add(suite);

var net = require('net'),
    http = require('http'),
    fs = require('fs'),
    https = require('https');

var mod_xlog = require("../lib/index.js");

suite.add(new YUITest.TestCase({

    'test_output_prefix' : function() {
        self = this;
        self.messageCounter = 0;

        var orgWrite = process.stdout.write;
        process.stdout.write = (function(write) {
            var regex = /^\[\d+:\d+\] /;
            return function(string, encoding, fd) {
                write.apply(process.stdout, arguments);
                if (string.match(regex) != null) {
                    ++self.messageCounter;
                }
            };
        }(process.stdout.write));

        var server = net.createServer(function(response) {
            response.write('HTTP/1.1 200 OK\r\n\r\n');
            response.end();
        });

        server.listen(3000, function() {
            var get = {
                method: 'HEAD',
                path: '/head',
                port: 3000,
                headers: { host: 'localhost.localdomain' }
            };
            var req = http.request(get, function(res) {
                server.close();
                console.log('HTTP Request');
                process.nextTick(function() {
                    console.log('nextTick');
                });
                setTimeout(function() {
                    console.log('setTimeout');
                }, 1);
                setInterval(function() {
                    console.log('setInterval');
                    clearInterval(this);
                }, 1);
                fs.readFile('tests/fixtures/agent2-cert.pem', function() {
                    console.log('readFile');
                });
            });
            req.end();
        });
        this.wait(
            function() {
                Assert.isTrue(this.messageCounter > 3, "Message counter should be > 3: " + this.messageCounter);
                process.stdout.write = orgWrite;
            },
            1000
        );
    },

    'test_output_https' : function() {
        self = this;
        self.messageCounter = 0;

        var orgWrite = process.stdout.write;
        process.stdout.write = (function(write) {
            var regex = /^\[\d+:\d+\] /;
            return function(string, encoding, fd) {
                write.apply(process.stdout, arguments);
                if (string.match(regex) != null) {
                    ++self.messageCounter;
                }
            };
        }(process.stdout.write));

        var options = {
            key: fs.readFileSync('tests/fixtures/agent2-key.pem'),
            cert: fs.readFileSync('tests/fixtures/agent2-cert.pem')
        };

        var server = https.createServer(options, function(req, response) {
            response.writeHead(200);
            response.end('OK\n');
        });

        server.listen(3000, function() {
            var get = {
                rejectUnauthorized: false,
                method: 'GET',
                path: '/https',
                port: 3000,
                headers: {
                    host: 'localhost.localdomain',
                    'Connection': 'close'
                }
            };
            var req = https.request(get, function(res) {
                server.close();
                console.log('HTTPS Request');
            });
            req.on('error', function(err) {
                server.close();
                console.error('ERROR: ' + err);
            });
            req.end();
        });
        this.wait(
            function() {
                process.stdout.write = orgWrite;
                Assert.isTrue(this.messageCounter > 1, "Message counter should be > 1: " + this.messageCounter);
            },
            1000
        );
    },

    'test_HTTP_GET' : function() {
        self = this;
        self.messageCounter = 0;

        var orgWrite = process.stdout.write;

        process.stdout.write = (function(write) {
            var regex = /^\[\d+:\d+\] /;
            return function(string, encoding, fd) {
                write.apply(process.stdout, arguments);
                if (string.match(regex) != null) {
                    ++self.messageCounter;
                }
            };
        }(process.stdout.write));

        var server = http.createServer(function(req, response) {
            response.writeHead(200);
            response.end('OK\n');
        });

        server.listen(3000, function() {
            var get = {
                method: 'GET',
                path: '/httpGet',
                port: 3000,
                headers: {
                    host: 'localhost.localdomain',
                    'Connection': 'close'
                }
            };
            var req = http.get(get, function(res) {
                server.close();
                console.log('HTTP Get');
            });
            req.end();
        });
        this.wait(
            function() {
                Assert.isTrue(this.messageCounter > 1, "Message counter should be > 1: " + this.messageCounter);
                process.stdout.write = orgWrite;
            }, 1000
        );
    },

    'test_HTTPS_GET' : function() {
        self = this;
        self.messageCounter = 0;

        var orgWrite = process.stdout.write;

        process.stdout.write = (function(write) {
            var regex = /^\[\d+:\d+\] /;
            return function(string, encoding, fd) {
                write.apply(process.stdout, arguments);
                if (string.match(regex) != null) {
                    ++self.messageCounter;
                }
            };
        }(process.stdout.write));

        var options = {
            key: fs.readFileSync('tests/fixtures/agent2-key.pem'),
            cert: fs.readFileSync('tests/fixtures/agent2-cert.pem')
        };

        var server = https.createServer(options, function(req, response) {
            response.writeHead(200);
            response.end("OK\n");
        });
        server.listen(3000, function() {
            var get = {
                rejectUnauthorized: false,
                method: 'GET',
                path: '/httpsGet',
                port: 3000,
                headers: {
                    host: 'localhost.localdomain',
                    'Connection': 'close'
                }
            };
            var req = https.get(get, function(res) {
                server.close();
                console.log('HTTPS Get');
            });
            req.end();
        });
        this.wait(
            function() {
                Assert.isTrue(this.messageCounter > 1, "Message counter should be > 1: " + this.messageCounter);
                process.stdout.write = orgWrite;
            }, 2000
        );
    },

    'test_xlog_initialization' : function() {
        var initFunction = mod_xlog();
        Assert.isTrue(typeof initFunction == 'function', 'Should be function: ' + typeof initFunction);
        initFunction ('request', 'response', function() {
            Assert.isTrue(process.__request == 'request', 'process.__request: ' + process.__request);
        });
    }

}));
