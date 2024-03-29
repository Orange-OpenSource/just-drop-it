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

import {Server, Socket} from "socket.io";
import Debug from "debug";
import {Server as HTTPServer} from "http";
import {FileSender, FileReceiver, Dao} from "./dao";
import UrlGenerator from "./url-generator";

let ss = require('socket.io-stream');

const debug = Debug("app:ioserver");
const error = Debug("app:ioserver");

debug.log = console.log.bind(console);

export class IoServerWrapper {
    sendNamespace = "/send";
    receiveNamespace = '/receive';

    dao = Dao.getInstance();
    uriGenerator = new UrlGenerator();

    private static _extractId(originNamespace: string, socket: Socket): string|undefined {
        debug("%s - new client - %s", originNamespace, socket.id);
        if( socket.id != undefined){
            return socket.id
        } else {
            let errorMsg = 'Invalid id received: ' + socket.id;
            error(errorMsg);
            socket.emit('alert', errorMsg);
            return undefined;
        }
    }

    extractSenderId(socket: Socket) {
        return IoServerWrapper._extractId(this.sendNamespace, socket);
    }

    extractReceiverId(socket: Socket) {
        return IoServerWrapper._extractId(this.receiveNamespace, socket);
    }

    emitError(socket: Socket, errorMessage: string) {
        error(errorMessage);
        socket.emit('alert', errorMessage);
    }

    routingError(socket: Socket) {
        this.emitError(socket, 'routing error');
    }

    wrapServer(servePath: string, downloadPath: string, server: HTTPServer) {
        let socketIoServer = new Server(server, {path: "/_ws/socket.io/"});
        let self = this;

        socketIoServer.of(this.sendNamespace).on('connection',
            function (socket) {
                let senderId = self.extractSenderId(socket);
                if (senderId != undefined) {
                    self.dao.createSender(senderId, socket, function () {
                        socket.on("snd_file_ready", function (info) {
                            self.dao.getSender(senderId, function (sender: FileSender) {
                                sender.fileName = info.name;
                                sender.fileSize = info.size;
                                sender.uri = self.uriGenerator.generateUrl();

                                debug("Generated uri " + sender.uri);
                                socket.emit('server_rcv_url_generated', servePath + sender.uri);
                            }, function () {
                                self.routingError(socket);
                            });

                        });

                        //ON SEND_FILE EVENT (stream)
                        ss(socket).on('snd_send_file', function (stream: any, receiverId: string) {
                            debug("%s/%s send file", senderId, receiverId);
                            self.dao.getReceiver(senderId, receiverId, function (receiver: FileReceiver) {
                                debug("%s/%s Expose stream for receiver size=%d", senderId, receiverId, receiver.sender.fileSize);
                                //notifying receiver
                                receiver.stream = stream;
                                receiver.socket.emit('server_stream_ready', downloadPath + senderId + "/" + receiverId);
                            }, function () {
                                self.routingError(socket);
                            });

                        });


                        // DISCONNECT event
                        socket.on('disconnect', function () {
                            self.dao.getSender(senderId, function (sender: FileSender) {
                                sender.receivers.forEach((receiver) => {
                                    receiver.socket.emit('server_sender_left');
                                })

                                self.dao.removeSender(senderId, function () {
                                    debug("%s sender disconnect", socket.id);
                                }, function () {
                                    self.routingError(socket);
                                });
                            }, function () {
                                self.routingError(socket);
                            });

                        });
                    });
                }
            });

        socketIoServer.of(this.receiveNamespace).on('connection',
            function (socket) {
                let receiverId = self.extractReceiverId(socket);
                if (receiverId != undefined) {
                    socket.on('rcv_sender', function (senderId) {
                        debug("%s/%s receiver", senderId, receiverId);
                        self.dao.addReceiver(senderId, receiverId!, socket, function (sender: FileSender) {
                            debug("%s/%s receiver registered ", senderId, receiverId);

                            // DISCONNECT event
                            socket.on('disconnect', function () {

                                self.dao.getSender(senderId, function (sender: FileSender) {

                                    if (sender.removeReceiver(receiverId))
                                        sender.socket.emit('server_receiver_left', receiverId);

                                }, function () {
                                    self.routingError(socket);
                                });
                            });

                            sender.socket.emit('server_receiver_ready', receiverId);
                        }, function () {
                            self.emitError(socket, 'unknown senderID: ' + senderId);
                        });
                    });
                }
            });
        return socketIoServer;
    }

}


