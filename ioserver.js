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

function wrapServer(app, server){
    var socketIoServer = io.listen(server);

    // on socket connections
    socketIoServer.on('connection', function (socket) {
        function emitError(errorMessage){
            error(errorMessage);
            socket.emit('alert', errorMessage);
        }

        function routingError(){
            emitError('routing error');
        }


        if (typeof socket.handshake.query.role === "undefined") {
            emitError('Error, no profile transmitted');

        } else {
            if (socket.handshake.query.role == 'sender') { // SENDER ---------------------------------
                dao.createSender(socket.id, socket, function(){
                    debug('New sender with id : %s',socket.id);
                    socket.on("snd_file_ready", function(info){
                        dao.getSender(socket.id, function(sender){
                            sender.fileName = info.name;
                            sender.fileSize = info.size;
                            socket.emit('server_rcv_url_generated',  app.receiverServePagePath+socket.id);
                        }, routingError);

                    });

                    //ON SEND_FILE EVENT (stream)
                    ss(socket).on('snd_send_file', function (stream, receiverId) {
                        debug("%s/%s send file",socket.id, receiverId);
                        dao.getReceiver(socket.id, receiverId, function(receiver){
                            debug("%s/%s Expose stream for receiver size=%d", socket.id, receiverId, receiver.sender.fileSize);
                            //notifying receiver
                            receiver.stream = stream;
                            receiver.socket.emit('server_stream_ready', app.receiverDownloadPath+socket.id + "/" + receiverId);
                            receiver.watchSent(function(percent){
                                receiver.socket.emit('server_sent_percent', percent);
                                socket.emit('server_sent_percent', receiverId, percent);
                            });

                            function receiverEnded(receiverEvent){
                                receiver.socket.emit(receiverEvent);
                                socket.emit(receiverEvent, receiver.receiverId);
                                dao.getSender(socket.id, function(sender){
                                    debug("%s/%s %s - filename=%s - filesize=%d", socket.id, receiver.receiverId, receiverEvent, sender.fileName, sender.fileSize);
                                    sender.removeReceiver(receiver.receiverId);
                                }, routingError);
                            }

                            receiver.watchFinished(function(){
                                receiverEnded('server_transfer_complete')
                            });
                            receiver.watchTimeout(function(){
                                receiverEnded('server_transfer_timeout');

                            });
                        }, routingError);

                    });


                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        dao.getSender(socket.id, function(sender){
                            sender.eachReceiver(function(receiver){
                                receiver.socket.emit('server_sender_left');
                            });
                            dao.removeSender(socket.id, function(){
                                debug("%s sender disconnect", socket.id);
                            }, routingError);
                        }, routingError);

                    });
                });

            } else if (socket.handshake.query.role == 'receiver') { // RECEIVER ---------------------------------
                var senderID = socket.handshake.query.senderID;


                debug("%s/%s new receiver", senderID || "undefined", socket.id);


                dao.addReceiver(senderID, socket.id, socket, function(sender){
                    debug("%s/%s receiver registered ", senderID, socket.id);

                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        dao.getSender(senderID, function(sender){
                            if(sender.removeReceiver(socket.id))
                                sender.socket.emit('server_receiver_left', socket.id);
                        }, routingError);
                    });



                    sender.socket.emit('server_receiver_ready', socket.id);
                }, function(){
                    error('Error: unkown senderID %s', senderID);
                    socket.emit('alert', 'unkown senderID');
                });

            } else {
                emitError('Error, unknown profile');

            }
        }
    });
    return socketIoServer;

}
