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
import {Dao, FileReceiver, FileSender} from "../server/dao";
import {Request, Response} from "express";
import Utils from "../server/utils";

const debug = Debug("app:routes:admin");
debug.log = console.log.bind(console);

export class AdminRouter {
    router = require('express').Router();

    dao = Dao.getInstance();

    get() {
        const self = this;
        this.router.get('/', function (req: Request, res: Response) {


            const senders: Object[] = [];
            self.dao.eachSender((sender) => {
                const receivers: String[] = [];
                const senderUIObject = {id: sender.senderId, receivers: receivers, fileName: sender.fileName};
                sender.eachReceiver((receiver: FileReceiver) => {
                    senderUIObject.receivers.push(receiver.receiverId);
                });
                senders.push(senderUIObject);
            })


            debug([...self.dao.senders.values()])
            res.render('admin', {
                title: "Just drop it Admin",
                isLocal: Utils.isDevDeployment(),
                jdropitVersion: Utils.getVersion(),
                dumbContent: "",
                senders: senders
            });
        });

        return this.router;
    }
}
