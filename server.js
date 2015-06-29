#!/bin/env node

"use strict";
var defaultDebugMode =   "app:*";
if(typeof process.env.DEBUG == "undefined"){
    console.log("Adding DEBUG variable to "+defaultDebugMode);
    process.env.DEBUG=defaultDebugMode;
}else{
    console.log("DEBUG already set to "+defaultDebugMode);
}


var http = require('http');



var debug = require('debug')('app:server');
var error = require('debug')('app:server');
var app = require("./app");

debug.log = console.log.bind(console);

var server = http.createServer(app);

//retrieve Kermit variables
var ipAddress = process.env.OPENSHIFT_NODEJS_IP || error('No OPENSHIFT_NODEJS_IP var, using ANY') || null;
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

//------------------------
require("./ioserver")(app, server);
//  Start the app on the specific interface (and port).
server.listen(port, ipAddress, function () {
    var mDate = new Date(Date.now());
    debug('%s: Node server started on %s:%d ...', mDate, ipAddress == null? "*" : ipAddress, port);
});




