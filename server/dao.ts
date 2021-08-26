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
import {Socket} from "socket.io";

const debug = Debug("app:dao");
debug.log = console.log.bind(console);

export class Dao {

    private static instance: Dao;

    /**
     * The Singleton's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
    private constructor() {    debug("dao created"); }

    public static getInstance(): Dao {
        if (!Dao.instance) {
            Dao.instance = new Dao();
        }

        return Dao.instance;
    }

    senders = new Map<string, FileSender>();

    createSender(senderId: string, socket: Socket, callback: (created: FileSender) => void) {
        const result = new FileSender(senderId, socket);
        this.senders.set(senderId, result);
        callback(result);
    };

    removeSender(senderId: string | undefined, deletedCallback: () => void, notFoundCallback: () => void) {
        if (senderId != undefined && this.senders.get(senderId) != undefined) {
            this.senders.delete(senderId)
            deletedCallback();
        } else {
            notFoundCallback()
        }
    };

    getSender(senderId: string | undefined, callback: (sender: FileSender) => void, notFoundCallback: () => void) {
        if (senderId!=undefined && this.senders.get(senderId) != undefined) {
            callback(this.senders.get(senderId)!);
        } else {
            notFoundCallback()
        }
    };

    getSenderFromUri(uri: string, callback: (sender: FileSender) => void, notFoundCallback: () => void) {
        debug("Searching sender for URI %s", uri);
        const matchingSender = Array.from(this.senders.values()).find((item: FileSender) => item.uri === uri)
        if (matchingSender === undefined) {
            notFoundCallback()
        } else {
            debug("sender found");
            callback(matchingSender)
        }
    };

    addReceiver(senderId: string, receiverId: string, socket: Socket, callback: (sender: FileSender) => void, notFoundCallback: () => void) {
        const sender = this.senders.get(senderId)
        if (sender != undefined) {
            sender!.addReceiver(receiverId, socket);
            callback(sender);
        } else {
            notFoundCallback()
        }
    };

    getReceiver(senderId: string|undefined, receiverId: string, callback: (sender: FileReceiver) => void, notFoundCallback: () => void) {
        if(senderId === undefined){
            return notFoundCallback()
        }
        const sender = this.senders.get(senderId)
        if (sender != undefined) {
            const receiver = sender.receivers.get(receiverId)
            if(receiver != undefined){
                callback(receiver);
            }else{
                notFoundCallback()
            }
        } else {
            notFoundCallback()
        }
    };
}


export class FileSender {
    receivers = new Map<string, FileReceiver>();

    fileSize: number | undefined;
    fileName: string | undefined;
    uri: string | undefined;

    constructor(readonly senderId: string, readonly socket: Socket) {
    }

    addReceiver(receiverId: string, socket: Socket) {
        debug('Sender - addReceiver - %s', receiverId);
        const result = new FileReceiver(this, receiverId, socket);
        this.receivers.set(receiverId, result);
        return result;
    }

    removeReceiver(id: string | undefined) {
        if (id == undefined) {
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

    constructor(readonly sender: FileSender, readonly receiverId: string, readonly socket: Socket) {
        debug('Receiver - init - %s', receiverId);
    }

    cleanIfPossible() {
        debug('Receiver - clean - %s', this.receiverId);
        //clean resources
        if (this.clean != undefined)
            this.clean();
    }

    notifySent(percent: number) {
        debug("notifySent - %d", percent);
        this.sender.socket.emit('server_sent_percent', this.receiverId, percent);
        this.socket.emit('server_sent_percent', percent);
    };

    private _end(endEvent: string) {
        if (!this.endNotified) {
            this.socket.emit(endEvent);
            this.sender.socket.emit(endEvent, this.receiverId);
            this.sender.removeReceiver(this.receiverId);
            debug("%s/%s %s - filename=%s - filesize=%d", this.sender.senderId, this.receiverId, endEvent, this.sender.fileName, this.sender.fileSize);
            this.endNotified = true;
        }
    };

    timeout() {
        this._end('server_transfer_timeout');
    };

    disconnected() {
        this._end('server_transfer_disconnected');
    };

    completed() {
        this._end('server_transfer_complete');
    };
}

