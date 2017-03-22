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
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var send = require('./routes/send');
var receive = require('./routes/receive');
var admin = require('./routes/admin');
var javascript = require('./routes/javascript');

var app = express();

global.DROP_IT_VERSION=parseFloat(require("./package.json").version);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(favicon(__dirname + '/public/images/favicon.png'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, path.join('node_modules', 'tether', 'dist'))));
app.use(express.static(path.join(__dirname, path.join('node_modules', 'boosted', 'dist'))));
app.use(express.static(path.join(__dirname, path.join('node_modules', 'jquery', 'dist','cdn'))));
app.use(express.static(path.join(__dirname, path.join('node_modules', 'jquery-file-download', 'src','Scripts'))));
app.use(express.static(path.join(__dirname, path.join('node_modules', 'clipboard', 'dist'))));

var receiveUriPath = '/receive';
app.use('/', send);
app.use(receiveUriPath, receive);
app.use('/admin', admin);
app.use('/js', javascript);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    console.log("not found");
    var err = new Error('Not Found');
    err.status = 404;
    err.sub_message = "";
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    console.log("enabling stacks");
    app.use(function(err, req, res, next) {
        console.error(err);
        res.status(err.status || 500);
        res.render('error', {
            dumbContent : "",
            isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
            jdropitVersion: global.DROP_IT_VERSION,
            message: err.message,
            sub_message: err.sub_message,
            error: err
        });
    });
}



// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        dumbContent : "",
        isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
        jdropitVersion : global.DROP_IT_VERSION,
        message: err.message,
        sub_message: err.sub_message,
        stack: err.stack
    });
});

app.receiverServePagePath = receiveUriPath + receive.servePagePath;
app.receiverDownloadPath = receiveUriPath + receive.downloadPath;

module.exports = app;

