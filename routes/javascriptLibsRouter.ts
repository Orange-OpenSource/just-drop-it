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


import * as Buffer from "buffer";

import Debug from "debug";
import {Request, Response} from "express";
import Utils from "../server/utils";

const debug = Debug("app:routes:javascript");
debug.log = console.log.bind(console);

export class JavascriptLibsRouter {
    router = require('express').Router();

    read = require('fs').readFileSync;

    isLocal: boolean = Utils.isDevDeployment();
    uglifyJS = require("uglify-js");

    private _routeLibrary(libName: string, sourceLoader: () => string, reloadOnLocal: boolean) {
        debug("preparing route for lib %s", libName)
        const source = sourceLoader();
        const sourceMin = this.uglifyJS.minify(source).code;

        this.router.get('/' + libName + '.js', (req: Request, res: Response) => {
            debug("providing %s", libName);
            res.setHeader('Content-Type', 'application/javascript');
            if (this.isLocal && reloadOnLocal) {//re read each time
                res.status(200).end(sourceLoader());
            } else {
                res.status(200).end(source);
            }
        });
        this.router.get('/' + libName + '.min.js', (req: Request, res: Response) => {
            console.log("providing %s minified", libName);
            res.setHeader('Content-Type', 'application/javascript');
            res.status(200).end(sourceMin);
        });
    }

    get() {
        const self = this;

        const commonLibraries = ['socket.io-client', 'debug'];

        const servedFiles: Map<string, string> = new Map<string, string>([
            ["jdropit-notif", '../client/jdropit-notif.js'],
            ["jdropit-whatsnew", '../client/jdropit-whatsnew.js'],
            ["jdropit-send", '../client/jdropit-send.js'],
            ["jdropit-receive", '../client/jdropit-receive.js'],
            ["socket.io-stream", 'socket.io-stream/socket.io-stream.js']]
        );

        const browserify = require('browserify');

        servedFiles.forEach((path:string, libName: string) =>{
            this._routeLibrary(libName,  () => {
                return self.read(require.resolve(path), 'utf-8');
            }, true);
        })

        const browserifyEngine = browserify([], {basedir: __dirname});
        for (let cpt = 0; cpt < commonLibraries.length; cpt++) {
            browserifyEngine.require(commonLibraries[cpt]);
        }
        const stream = browserifyEngine.bundle();
        const fileData: any[] = [];
        stream.on('data',  (data: Buffer) => {
            fileData.push(data);
        });
        stream.on('end',  () => {
            const data = fileData.join('');
            self._routeLibrary('common-libraries',  () => {
                return data;
            }, false);
        });

        return this.router;
    }
}




