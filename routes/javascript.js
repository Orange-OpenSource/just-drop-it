/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This program is free software; you can redistribute it and/or
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
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

var express = require('express');
var read = require('fs').readFileSync;
var uglifyJS = require("uglify-js");
var router = express.Router();
var debug = require('debug')('app:routes:javascript');
debug.log = console.log.bind(console);

var servedFiles = {
    "socket.io" : 'socket.io-client/socket.io.js',
    "socket.io-stream" : 'socket.io-stream/socket.io-stream.js',
    "jdropit-send" : '../client/jdropit-send.js',
    "jdropit-receive" : '../client/jdropit-receive.js',
    "jdropit-notif" : '../client/jdropit-notif.js',
    "jdropit-whatsnew" : '../client/jdropit-whatsnew.js'
};

var isLocal = typeof process.env.OPENSHIFT_NODEJS_IP === "undefined";

function defineRoutesForLibrairy(libName){
    var libDefinition = servedFiles[libName];
    var source = read(require.resolve(libDefinition), 'utf-8');
    var sourceMin = uglifyJS.minify(source, {fromString: true}).code;
    router.get('/'+libName+'.js', function(req, res) {
        debug("providing %s", libName);
        res.setHeader('Content-Type', 'application/javascript');
        if(isLocal) {//re read each time
            res.status(200).end(read(require.resolve(libDefinition), 'utf-8'));
        }else{
            res.status(200).end(source);
        }
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
