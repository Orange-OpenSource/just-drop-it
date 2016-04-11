/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This program is free software; you can redistribute it and/or
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
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

var io = require('socket.io');
var ss = require('socket.io-stream');
var dao = require("./dao")
var debug = require('debug')('app:ioserver');
var error = require('debug')('app:ioserver');
debug.log = console.log.bind(console);


exports = module.exports = wrapServer;

function wrapServer(app, server) {
    var socketIoServer = io.listen(server);
    var sendNamespace = "/send";
    var receiveNamespace = '/receive';

    // on socket connections
    function extractId(originNamespace, socket) {
        debug("%s - new client - %s", originNamespace, socket.id);
        if (socket.id.indexOf(originNamespace + "#") == 0) {
            return socket.id.substring(originNamespace.length + 1);
        } else {
            var errorMsg = 'Invalid id received: ' + socket.id;
            error(errorMsg);
            socket.emit('alert', errorMsg);
            return null;
        }
    }

    function emitError(socket, errorMessage) {
        error(errorMessage);
        socket.emit('alert', errorMessage);
    }

    function routingError(socket) {
        emitError(socket, 'routing error');
    }

    socketIoServer.of(sendNamespace).on('connection',
        function (socket) {
            var senderId = extractId(sendNamespace, socket);
            if (senderId != null) {
                dao.createSender(senderId, socket, function () {
                    socket.on("snd_file_ready", function (info) {
                        dao.getSender(senderId, function (sender) {
                            sender.fileName = info.name;
                            sender.fileSize = info.size;
                            socket.emit('server_rcv_url_generated', app.receiverServePagePath + senderId);
                        }, function () {
                            routingError(socket);
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
                            routingError(socket);
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
                                routingError(socket);
                            });
                        }, function () {
                            routingError(socket);
                        });

                    });
                });
            }

        });

    socketIoServer.of(receiveNamespace).on('connection',
        function (socket) {
            var receiverId = extractId(receiveNamespace, socket);
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
                                    routingError(socket);
                                });
                        });

                        sender.socket.emit('server_receiver_ready', receiverId);
                    }, function () {
                        emitError(socket, 'unknown senderID' + senderId);
                    });
                });
            }
        });
    return socketIoServer;

}
