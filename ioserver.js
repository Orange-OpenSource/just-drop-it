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

let io = require('socket.io');
let ss = require('socket.io-stream');
let dao = require("./dao")
let debug = require('debug')('app:ioserver');
let error = require('debug')('app:ioserver');
debug.log = console.log.bind(console);
let uriGenerator = require("./url-generator");


exports = module.exports = new IoServerWrapper();


function IoServerWrapper() {
    this.sendNamespace = "/send";
    this.receiveNamespace = '/receive';
}

IoServerWrapper.prototype._extractId = function(originNamespace, socket) {
    debug("%s - new client - %s", originNamespace, socket.id);
    if (socket.id.indexOf(originNamespace + "#") == 0) {
        return socket.id.substring(originNamespace.length + 1);
    } else {
        let errorMsg = 'Invalid id received: ' + socket.id;
        error(errorMsg);
        socket.emit('alert', errorMsg);
        return null;
    }
}

IoServerWrapper.prototype.extractSenderId = function (socket){
    return this._extractId(this.sendNamespace, socket);
}

IoServerWrapper.prototype.extractReceiverId = function (socket){
    return this._extractId(this.receiveNamespace, socket);
}

IoServerWrapper.prototype.emitError = function (socket, errorMessage) {
    error(errorMessage);
    socket.emit('alert', errorMessage);
}

IoServerWrapper.prototype.routingError = function(socket) {
    this.emitError(socket, 'routing error');
}

IoServerWrapper.prototype.wrapServer = function (app, server) {
    let socketIoServer = io.listen(server);
    let serverWrapper = this;

    socketIoServer.of(serverWrapper.sendNamespace).on('connection',
        function (socket) {
            let senderId = serverWrapper.extractSenderId(socket);
            if (senderId != null) {
                dao.createSender(senderId, socket, function () {
                    socket.on("snd_file_ready", function (info) {
                        dao.getSender(senderId, function (sender) {
                            sender.fileName = info.name;
                            sender.fileSize = info.size;
                            sender.uri = uriGenerator.generateUrl();

                            debug("Generated uri "+ sender.uri);
                            socket.emit('server_rcv_url_generated', app.receiverServePagePath + sender.uri);
                        }, function () {
                            serverWrapper.routingError(socket);
                        });

                    });

                    //ON SEND_FILE EVENT (stream)
                    ss(socket).on('snd_send_file', function (stream, receiverId) {
                        debug("%s/%s send file", senderId, receiverId);
                        dao.getReceiver(senderId, receiverId, function (receiver) {
                            debug("%s/%s Expose stream for receiver size=%d", senderId, receiverId, receiver.sender.fileSize);
                            //notifying receiver
                            receiver.stream = stream;
                            receiver.socket.emit('server_stream_ready', app.receiverDownloadPath + senderId + "/" + receiverId);
                        }, function () {
                            serverWrapper.routingError(socket);
                        });

                    });


                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        dao.getSender(senderId, function (sender) {
                            sender.eachReceiver(function (receiver) {
                                receiver.socket.emit('server_sender_left');
                            });
                            dao.removeSender(senderId, function () {
                                debug("%s sender disconnect", socket.id);
                            }, function () {
                                serverWrapper.routingError(socket);
                            });
                        }, function () {
                            serverWrapper.routingError(socket);
                        });

                    });
                });
            }

        });

    socketIoServer.of(serverWrapper.receiveNamespace).on('connection',
        function (socket) {
            let receiverId = serverWrapper.extractReceiverId(socket);
            if (receiverId != null) {
                socket.on('rcv_sender', function (senderId) {
                    debug("%s/%s receiver", senderId, receiverId);
                    dao.addReceiver(senderId, receiverId, socket, function (sender) {
                        debug("%s/%s receiver registered ", senderId, receiverId);

                        // DISCONNECT event
                        socket.on('disconnect', function () {

                                dao.getSender(senderId, function (sender) {

                                    if (sender.removeReceiver(receiverId))
                                        sender.socket.emit('server_receiver_left', receiverId);

                                }, function () {
                                    serverWrapper.routingError(socket);
                                });
                        });

                        sender.socket.emit('server_receiver_ready', receiverId);
                    }, function () {
                        serverWrapper.emitError(socket, 'unknown senderID: ' + senderId);
                    });
                });
            }
        });
    return socketIoServer;

}
