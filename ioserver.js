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
        function routingError(){
            error('Error: routing error');
            socket.emit('alert', 'routing error');
        }


        if (typeof socket.handshake.query.role === "undefined") {
            var errorMsg = 'Error, no profile transmitted';
            error(errorMsg);
            socket.emit('alert', errorMsg);

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
                            debug("%s/%s [-->%s] Expose stream for receiver size=%d", socket.id, receiverId,receiver.receiverLabel, receiver.sender.fileSize);
                            //notifying receiver
                            receiver.stream = stream;
                            receiver.socket.emit('server_stream_ready', app.receiverDownloadPath+socket.id + "/" + receiverId);
                            receiver.watchSent(function(nbSent){
                                receiver.socket.emit('server_sent_bytes', nbSent);
                            });
                            receiver.watchFinished(function(){
                                receiver.socket.emit('server_transfer_complete');
                                dao.getSender(socket.id, function(sender){
                                    debug("%s/%s transfer_complete - filename=%s - filesize=%d", socket.id,receiver.receiverId, sender.fileName, sender.fileSize);
                                    sender.removeReceiver(receiver.receiverId);
                                }, routingError);

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
                var receiverLabel = socket.handshake.query.receiverLabel;

                if(typeof receiverLabel == "undefined" || receiverLabel.length == 0 ){
                    receiverLabel = "unknown receiver"
                }
                debug("%s/%s/%s new receiver", senderID || "undefined", socket.id, receiverLabel);


                dao.addReceiver(senderID, socket.id, receiverLabel, socket, function(sender){
                    debug("%s/%s receiver registered ", senderID, socket.id);

                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        dao.getSender(senderID, function(sender){
                            if(sender.removeReceiver(socket.id))
                                sender.socket.emit('server_receiver_left', socket.id,receiverLabel);
                        }, routingError);
                    });



                    sender.socket.emit('server_receiver_ready', socket.id,receiverLabel);
                }, function(){
                    error('Error: unkown senderID %s', senderID);
                    socket.emit('alert', 'unkown senderID');
                });

            } else {
                var errorMsg = 'Error, unknown profile';
                error(errorMsg);
                socket.emit('alert', errorMsg);
            }
        }
    });
    return socketIoServer;

}
