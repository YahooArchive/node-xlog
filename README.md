xlog
=======

Simple express/connect middleware that extends console.log and console.err to add a prefix
which contains the node.js PID and the http request URL and an identification counter.

The node implementation at Yahoo uses cluster that spawns multiple processes that handle internet traffic.
There are some situation when errors are logged but it is not clear what caused it, this
is specially true of uncaught exceptions. This module captures the most common async
functions available in node so it can capture the request and display the information
in the error log.

Both the console.log and console.error are extended to display the PID of the process
that generated the log as well as the request method and URL path. This information is only
displayed the first time a log is generated for a request when it is indexed. Subsequent
logs will only show the PID and the index.

For example is there are two entry points ('/getUser' and '/setUser') with GET and POST
methods the log file could look something like:

```
[1234:1] Method: GET - url: /getUser 
[1234:1] GetMessage1`
[1234:2] Method: POST - url: /setUser
[1234:2] PostMessage1
[1234:1] GetMessage2
[1333:3] Method: GET - url: /getUser
[1333:3] GetMessage2User</br>
[1333:3] GetMessage2</br>
```

The exception to the indexing rule is uncaught exceptions when the module will always
display the PID and request information.

install
-------
With npm do:

`npm install xlog`

usage
-----

```javascript
var express = require('express'),
    xlog = require('xlog');

var app = express();

app.use(xlog());

app.listen(8000);
```
