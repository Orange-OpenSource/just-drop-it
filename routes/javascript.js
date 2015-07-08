/**
 * Created by buce8373 on 19/05/2015.
 */


var express = require('express');
var read = require('fs').readFileSync;
var uglifyJS = require("uglify-js");
var router = express.Router();
var debug = require('debug')('app:routes:javascript');
debug.log = console.log.bind(console);

var servedFiles = {
    "socket.io" : 'socket.io/node_modules/socket.io-client/socket.io.js',
    "socket.io-stream" : 'socket.io-stream/socket.io-stream.js',
    "jdropit-send" : '../client/jdropit-send.js',
    "jdropit-receive" : '../client/jdropit-receive.js'

};

function defineRoutesForLibrairy(libName){
    var libDefinition = servedFiles[libName];
    var source = read(require.resolve(libDefinition), 'utf-8');
    var sourceMin = uglifyJS.minify(source, {fromString: true}).code;
    router.get('/'+libName+'.js', function(req, res) {
        debug("providing %s", libName);
        res.setHeader('Content-Type', 'application/javascript');
        res.status(200).end(source);
    });
    router.get('/'+libName+'.min.js', function(req, res) {
        console.log("providing %s minified", libName);
        res.setHeader('Content-Type', 'application/javascript');
        res.status(200).end(sourceMin);
    });
    debug("%s routed", libName);
}

for(var libName in servedFiles){
    if(servedFiles.hasOwnProperty(libName)){
        defineRoutesForLibrairy(libName);
    }
}

module.exports = router;
