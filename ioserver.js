/**
 * Created by buce8373 on 22/06/2015.
 */
var io = require('socket.io');
var ss = require('socket.io-stream');
var debug = require('debug')('app:ioserver');
var error = require('debug')('app:ioserver');
debug.log = console.log.bind(console);


exports = module.exports = wrapServer;

function wrapServer(app, server){
    var socketIoServer = io.listen(server);

    var senders = {}; // socketId -> {socket, receivers{ receiverId -> socket}}


    // on socket connections
    socketIoServer.on('connection', function (socket) {



        if (typeof socket.handshake.query.role === "undefined") {
            var errorMsg = 'Error, no profile transmitted';
            error(errorMsg);
            socket.emit('alert', errorMsg);

        } else {
            if (socket.handshake.query.role == 'sender') { // SENDER ---------------------------------

                senders[socket.id] = {socket: socket, receivers: {}};
                debug('New sender with id : %s',socket.id);

                //generate new unique url
                //warn sender that the receiver page is ready

                debug('server_rcv_url_generated emitted');

                socket.on("snd_file_ready", function(info){
                    socket.emit('server_rcv_url_generated',  app.receive_uri_path+app.prepareStream(socket.id, info.name, info.size));
                });

                //ON SEND_FILE EVENT (stream)
                ss(socket).on('snd_send_file', function (stream, receiverId,remainingBytes) {

                    debug("%s/%s send file",socket.id, receiverId);

                    //searching for the right receiver socket
                    var sender = senders[socket.id];
                    if (typeof sender == "undefined" ) {
                        error('Error: routing error');
                        socket.emit('alert', 'routing error');
                    } else {
                        var receiver = senders[socket.id].receivers[receiverId];
                        if(typeof receiver !== "undefined"){
                            //directly expose stream
                            var route = app.addReceiver(socket.id, receiverId, stream, remainingBytes);
                            debug("%s/%s [-->%s] Expose stream for receiver size=%d", socket.id, receiverId,receiver.label,remainingBytes);
                            //notifying receiver

                            receiver.socket.emit('server_stream_ready', app.receive_uri_path+route);
                        }else{
                            error('Error: routing error');
                            socket.emit('alert', 'routing error');
                        }
                    }
                });


                // DISCONNECT event
                socket.on('disconnect', function () {
                    var sender = senders[socket.id];
                    delete senders[socket.id];
                    for (var receiverId in sender.receivers) {
                        if (sender.receivers.hasOwnProperty(receiverId)) {
                            debug("%s/%s notifying receiver that sender left", socket.id, receiverId);
                            sender.receivers[receiverId].socket.emit('server_sender_left');
                        }
                    }
                    //closing stream
                    app.removeStream(socket.id);
                    debug("%s sender disconnect", socket.id);
                });

            } else if (socket.handshake.query.role == 'receiver') { // RECEIVER ---------------------------------
                var senderID = socket.handshake.query.senderID;
                var receiverLabel = socket.handshake.query.receiverLabel;
                if(typeof receiverLabel == "undefined" || receiverLabel.length == 0 ){
                    receiverLabel = "unknown receiver"
                }

                debug("%s/%s/%s new receiver", senderID, socket.id, receiverLabel);
                var sender = senders[senderID];
                if (typeof sender == "undefined") {
                    error('Error: unkown senderID %s', senderID);
                    socket.emit('alert', 'unkown senderID');
                } else {
                    //keeping reference between sender and receiver
                    sender.receivers[socket.id] ={socket: socket, label: receiverLabel};
                    debug("%s/%s receiver registered ", senderID, socket.id);

                    socket.on('rcv_transfer_complete', function(){
                        debug("%s/%s transfer_complete", senderID, socket.id);
                        app.removeReceiver(senderID, socket.id);
                    });
                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        debug("%s/%s receiver disconnect", senderID, socket.id);
                        if(app.removeReceiver(senderID, socket.id)){
                            sender.socket.emit('server_receiver_left', socket.id,receiverLabel);
                            debug("receiver %s has left!", socket.id);
                        }
                        delete sender.receivers[socket.id];
                    });


                    socket.on('rcv_resume_download', function (remainingBytes) {
                        debug("resuming download for %s %d bytes", socket.id, remainingBytes);
                        if(app.removeReceiver(senderID, socket.id)){
                            sender.socket.emit('rcv_resume_download', socket.id,remainingBytes);
                        }
                    });

                    /*TODO
                    socket.on('cancel_too_many_retries', function () {
                        debug("cancelling download because of too many retries ", socket.id);
                        sender.socket.emit('receiver_cancel_too_many_retries', socket.id,receiverLabel);
                        //remove the route otherwise sender will receive receiver_left event. Delete will be done on disconnection
                        app.removeReceiver(senderID, socket.id)
                    });*/

                    sender.socket.emit('server_receiver_ready', socket.id,receiverLabel);
                }
            } else {
                var errorMsg = 'Error, unknown profile';
                error(errorMsg);
                socket.emit('alert', errorMsg);
            }
        }
    });
    return socketIoServer;

}
