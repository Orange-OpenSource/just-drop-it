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
//TODO : check if we can get rid of socket.io-client
export class DAO {

}

import {Socket} from "socket.io";

const debug = Debug("app:dao");


export class FileSender {
    fileName: string | undefined;
    fileSize: number | undefined;
    receivers = new Map<string, FileReceiver>();

    uri: string;

    constructor(readonly senderId: string, readonly socket: Socket) {
    }

    addReceiver(receiverId: string, socket: Socket) {
        debug('Sender - addReceiver - %s', receiverId);
        const result = new FileReceiver(this, receiverId, socket);
        this.receivers.set(receiverId, result);
        return result;
    }

    removeReceiver(id: string|undefined) {
        if(id == undefined){
            return false
        }
        const receiver = this.receivers.get(id);
        if (receiver != undefined) {
            debug('Sender - removeReceiver - %s', id);
            receiver.cleanIfPossible();
            this.receivers.delete(id)
            return true;
        } else
            return false;
    }

    clean() {
        debug('Sender - clean - %s', this.senderId);
        //clean resources
        this._eachReceiver(function (receiver) {
            receiver.cleanIfPossible();
        });
        this.receivers.clear();
    }

    private _eachReceiver(functionToApplyToAllReceiver: (receiver: FileReceiver) => void) {
        [...this.receivers.values()].forEach(functionToApplyToAllReceiver)
    }

}

export class FileReceiver {
    endNotified: boolean = false;
    stream: any;

    // an void function of nothing.
    clean: (() => void) | undefined = undefined;


    constructor(readonly sender: FileSender, readonly receiverId: string, readonly socket: Socket) { // TODO remove socket rom Receiver object. Can retrieve it with its sender
        debug('Receiver - init - %s', receiverId);
    }

    cleanIfPossible() {
        debug('Receiver - clean - %s', this.receiverId);
        //clean resources
        if (this.clean != undefined)
            this.clean();
    }
}
