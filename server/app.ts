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

import {SendRouter} from "../routes/sendRouter";

let express = require('express');
let path = require('path');
let favicon = require('serve-favicon');
let logger = require('morgan');
let bodyParser = require('body-parser');

import {Express, NextFunction, Request, Response} from "express";
import {ReceiveRouter} from "../routes/receiveRouter";
import {AdminRouter} from "../routes/admin";
import {JavascriptLibsRouter} from "../routes/javascriptLibsRouter";
import Utils from "./utils";

export class App {

    app: Express

    receiveRouter = new ReceiveRouter();
    sendRouter = new SendRouter();

    receiveUriPath = '/receive';
    receiverServePagePath: string = this.receiveUriPath + this.receiveRouter.servePagePath;
    receiverDownloadPath: string = this.receiveUriPath + this.receiveRouter.downloadPath;

    constructor() {
        this.app = express();

        // view engine setup
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.set('view engine', 'pug');

        this.app.use(favicon(__dirname + '/public/images/favicon.png'));
        this.app.use(logger('dev'));
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.use(express.static(__dirname + '/../node_modules/boosted/dist'));
        this.app.use(express.static(__dirname + '/../node_modules/jquery/dist'));
        this.app.use(express.static(__dirname + '/../node_modules/jquery-file-download/src/Scripts'));
        this.app.use(express.static(__dirname + '/../node_modules/clipboard/dist'));

        this.app.use('/', this.sendRouter.get());
        this.app.use(this.receiveUriPath, this.receiveRouter.get());
        this.app.use('/admin', (new AdminRouter()).get());
        this.app.use('/js', (new JavascriptLibsRouter()).get());


// catch 404 and forward to error handler
        this.app.use(function (req: Request, res: Response, next: NextFunction) {
            console.log("not found");
            let err = {
                message: 'Not Found',
                status: 404,
                sub_message: "Check your url"
            };

            next(err);
        });

// error handlers

// development error handler
// will print stacktrace
        if (this.app.get('env') === 'development') {
            console.log("enabling stacks");
            this.app.use(function (err: any, req: Request, res: Response) {
                console.error(err);
                res.status(err.status || 500);
                res.render('error', {
                    dumbContent: "",
                    isLocal: Utils.isDevDeployment(),
                    jdropitVersion: Utils.getVersion(),
                    message: err.message,
                    sub_message: err.sub_message,
                    error: err
                });
            });
        }


// production error handler
// no stacktraces leaked to user
        this.app.use(function (err: any, req: Request, res: Response) {
            res.status(err.status || 500);
            res.render('error', {
                dumbContent: "",
                isLocal: Utils.isDevDeployment(),
                jdropitVersion: Utils.getVersion(),
                message: err.message,
                sub_message: err.sub_message,
                stack: err.stack
            });
        });


    }
}


