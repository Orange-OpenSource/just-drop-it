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

var express = require('express');
var read = require('fs').readFileSync;
var uglifyJS = require("uglify-js");
var router = express.Router();
var browserify = require('browserify');
var debug = require('debug')('app:routes:javascript');
debug.log = console.log.bind(console);

var servedFiles = {
    "jdropit-notif": '../client/jdropit-notif.js',
    "jdropit-whatsnew": '../client/jdropit-whatsnew.js',
    "jdropit-send": '../client/jdropit-send.js',
    "jdropit-receive": '../client/jdropit-receive.js',
    "socket.io-stream": 'socket.io-stream/socket.io-stream.js'
};

var commonLibraries = ['socket.io-client', 'debug'];


var isLocal = typeof process.env.OPENSHIFT_NODEJS_IP === "undefined";


function routeLibrary(libName, sourceLoader, reloadOnLocal) {
    var source = sourceLoader();
    var sourceMin = uglifyJS.minify(source, {fromString: true}).code;
    router.get('/' + libName + '.js', function (req, res) {
        debug("providing %s", libName);
        res.setHeader('Content-Type', 'application/javascript');
        if (isLocal && reloadOnLocal) {//re read each time
            res.status(200).end(sourceLoader());
        } else {
            res.status(200).end(source);
        }
    });
    router.get('/' + libName + '.min.js', function (req, res) {
        console.log("providing %s minified", libName);
        res.setHeader('Content-Type', 'application/javascript');
        res.status(200).end(sourceMin);
    });
}

for (var libName in servedFiles) {
    if (servedFiles.hasOwnProperty(libName)) {
        routeLibrary(libName, (function (libName) {
            return function () {
                return read(require.resolve(servedFiles[libName]), 'utf-8');
            }
        })(libName), true);
    }
}

var browserifyEngine = browserify([], {basedir: __dirname});
for (var cpt = 0; cpt < commonLibraries.length; cpt++){
    browserifyEngine.require(commonLibraries[cpt]);
}
var stream = browserifyEngine.bundle();
var fileData = [];
stream.on('data', function (data) {
    fileData.push(data);
});
stream.on('end', function () {
    var data = fileData.join('');
    routeLibrary('common-libraries', function(){
       return data;
    }, false);
});


module.exports = router;
