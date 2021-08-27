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

import Debug from "debug";
import {Request, Response} from "express";


const debug = Debug("app:routes:send");
debug.log = console.log.bind(console);

const dumbQuotes = ["Let us ease your file transfers",
    "Making the world a better place",
    "Make file transfers, not war",
    "When file transfer becomes pleasure",
    "File transfer is not a fatality",
    "Helping humanity thrive"];

export class SendRouter {
    router = require('express').Router();
    get(){
        /* GET home page. */
        this.router.get('/', function(req: Request, res: Response) {
            debug('serving view');
            res.render('send', {
                isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
                jdropitVersion : process.env.npm_package_version,
                infoMessage : typeof process.env.USER_INFO_MESSAGE === "undefined" ? "" : process.env.USER_INFO_MESSAGE,
                dumbContent : dumbQuotes[Math.floor(Math.random() * dumbQuotes.length)]
            });
        });

        /* GET home page. */
        this.router.get('/no_ie', function(req: Request, res: Response) {
            debug('serving no ie');
            res.render('no_ie', {title : "Sorry, your browser is not compatible"});
        });

        return this.router
    }

}

