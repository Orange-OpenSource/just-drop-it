/**
 * Created by buce8373 on 19/05/2015.
 */


var express = require('express');
var read = require('fs').readFileSync;
var router = express.Router();

var socketIoStreamSource = read(require.resolve('socket.io-stream/socket.io-stream.js'), 'utf-8');

router.get('/socket.io-stream.js', function(req, res, next) {
    console.log("providing socket io stream");
    res.setHeader('Content-Type', 'application/javascript');
    res.writeHead(200);
    res.end(socketIoStreamSource);
});

module.exports = router;
