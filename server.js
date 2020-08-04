#!/bin/env node
/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This file is part of just-drop-it.
 *
 * just-drop-it is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with just-drop-it.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";
var defaultDebugMode = "app:*";
if (typeof process.env.DEBUG == "undefined") {
    console.log("Adding DEBUG variable to " + defaultDebugMode);
    process.env.DEBUG = defaultDebugMode;
} else {
    console.log("DEBUG already set to " + process.env.DEBUG);
}


var http = require('http');


var debug = require('debug')('app:server');
var error = require('debug')('app:server');
var app = require("./app");

debug.log = console.log.bind(console);

var server = http.createServer(app);

//retrieve openshift variables
var ipAddress = process.env.OPENSHIFT_NODEJS_IP || error('No OPENSHIFT_NODEJS_IP var, using ANY') || null;
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

//------------------------
require("./ioserver").wrapServer(app, server);
//  Start the app on the specific interface (and port).
server.listen(port, ipAddress, function () {
    debug('%s: JustDropIt(%s) started on %s:%d ...',
        new Date(Date.now()), global.DROP_IT_VERSION, ipAddress == null ? "*" : ipAddress, port);
});




