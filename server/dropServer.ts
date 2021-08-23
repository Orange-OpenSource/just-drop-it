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


import * as http from "http";
import {App} from "./app";

import Debug from "debug";
import {Server} from "http";
const debug = Debug("app:server");
const error = Debug("app:server");

export class DropServer {

    start() {

        const defaultDebugMode = "app:*";
        if (typeof process.env.DEBUG == "undefined") {
            console.log("Adding DEBUG variable to " + defaultDebugMode);
            process.env.DEBUG = defaultDebugMode;
        } else {
            console.log("DEBUG already set to " + process.env.DEBUG);
        }



        debug.log = console.log.bind(console);

        const applicationWrapper = new App();
        const server: Server = http.createServer(applicationWrapper.app);

        //retrieve openshift variables
        const ipAddress : string|undefined = process.env.OPENSHIFT_NODEJS_IP || error('No OPENSHIFT_NODEJS_IP var, using ANY') || undefined;
        const port : number = process.env.OPENSHIFT_NODEJS_PORT as unknown as number || 8080;

        //------------------------
        require("./ioserver").wrapServer(applicationWrapper.receiverServePagePath, applicationWrapper.receiverDownloadPath, server);
        //  Start the app on the specific interface (and port).


        server.listen(port, ipAddress, () => {
            debug('%s: JustDropIt(%s) started on %s:%d ...',
                new Date(Date.now()), process.env.npm_package_version, ipAddress == null ? "*" : ipAddress, port);
        });


    }
}





