/**
 * Created by buce8373 on 22/06/2015.
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

    // on socket connections
    socketIoServer.on('connection', function (socket) {
        function emitError(errorMessage) {
            error(errorMessage);
            socket.emit('alert', errorMessage);
        }

        function routingError() {
            emitError('routing error');
        }

        function convertId(receivedId) {
            return receivedId.replace(/^\//, '').replace(/^#/, '')
        }

        var senderId, receiverId;

        if (typeof socket.handshake.query.role === "undefined") {
            emitError('Error, no profile transmitted');

        } else {
            if (socket.handshake.query.role == 'sender') { // SENDER ---------------------------------
                senderId = convertId(socket.id)
                dao.createSender(senderId, socket, function () {
                    debug('New sender with id : %s', senderId);
                    socket.on("snd_file_ready", function (info) {
                        dao.getSender(senderId, function (sender) {
                            sender.fileName = info.name;
                            sender.fileSize = info.size;
                            socket.emit('server_rcv_url_generated', app.receiverServePagePath + senderId);
                        }, routingError);

                    });

                    //ON SEND_FILE EVENT (stream)
                    ss(socket).on('snd_send_file', function (stream, receiverId) {
                        debug("%s/%s send file", senderId, receiverId);
                        dao.getReceiver(senderId, receiverId, function (receiver) {
                            debug("%s/%s Expose stream for receiver size=%d", senderId, receiverId, receiver.sender.fileSize);
                            //notifying receiver
                            receiver.stream = stream;
                            receiver.socket.emit('server_stream_ready', app.receiverDownloadPath + senderId + "/" + receiverId);
                            receiver.watchSent(function (percent) {
                                receiver.socket.emit('server_sent_percent', percent);
                                socket.emit('server_sent_percent', receiverId, percent);
                            });

                            function receiverEnded(receiverEvent) {
                                receiver.socket.emit(receiverEvent);
                                socket.emit(receiverEvent, receiver.receiverId);
                                dao.getSender(senderId, function (sender) {
                                    debug("%s/%s %s - filename=%s - filesize=%d", senderId, receiver.receiverId, receiverEvent, sender.fileName, sender.fileSize);
                                    sender.removeReceiver(receiver.receiverId);
                                }, routingError);
                            }

                            receiver.watchFinished(function () {
                                receiverEnded('server_transfer_complete')
                            });
                            receiver.watchTimeout(function () {
                                receiverEnded('server_transfer_timeout');

                            });
                        }, routingError);

                    });


                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        dao.getSender(senderId, function (sender) {
                            sender.eachReceiver(function (receiver) {
                                receiver.socket.emit('server_sender_left');
                            });
                            dao.removeSender(senderId, function () {
                                debug("%s sender disconnect", socket.id);
                            }, routingError);
                        }, routingError);

                    });
                });

            } else if (socket.handshake.query.role == 'receiver') { // RECEIVER ---------------------------------
                senderId = socket.handshake.query.senderID;
                receiverId = convertId(socket.id);

                debug("%s/%s new receiver", senderId || "undefined", receiverId);


                dao.addReceiver(senderId, receiverId, socket, function (sender) {
                    debug("%s/%s receiver registered ", senderId, receiverId);

                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        dao.getSender(senderID, function (sender) {
                            if (sender.removeReceiver(receiverId))
                                sender.socket.emit('server_receiver_left', receiverId);
                        }, routingError);
                    });


                    sender.socket.emit('server_receiver_ready', receiverId);
                }, function () {
                    error('Error: unkown senderId %s', senderID);
                    socket.emit('alert', 'unkown senderID');
                });

            } else {
                emitError('Error, unknown profile');

            }
        }
    });
    return socketIoServer;

}
