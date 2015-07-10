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

                debug('receive_url_ready emitted');

                socket.on("file_ready", function(info){
                    socket.emit('receive_url_ready',  app.receive_uri_path+app.prepareStream(socket.id, info.name, info.size));
                });

                //ON SEND_FILE EVENT (stream)
                ss(socket).on('send_file', function (stream, receiverId,senderLabel) {

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
                            var info = app.addReceiver(socket.id, receiverId, stream);
                            debug("%s/%s [%s-->%s] Expose stream for receiver filename=%s, size=%d", socket.id, receiverId, senderLabel,receiver.label, info.filename, info.size);
                            //notifying receiver

                            receiver.socket.emit('stream_ready', app.receive_uri_path+info.route, info.filename, info.size);
                        }else{
                            error('Error: routing error');
                            socket.emit('alert', 'routing error');
                        }
                    }
                });

                // TRANSFER_IN_PROGRESS event
                socket.on('transfer_in_progress', function (progress, receiverId) {
                    //simple routing on the other socket
                    var receiver = senders[socket.id].receivers[receiverId];
                    if(typeof receiver !== "undefined")
                        receiver.socket.emit('transfer_in_progress', progress);
                    else
                        debug("%s/%s receiver not registered", socket.id, receiverId);
                });

                // DISCONNECT event
                socket.on('disconnect', function () {
                    var sender = senders[socket.id];
                    delete senders[socket.id];
                    for (var receiverId in sender.receivers) {
                        if (sender.receivers.hasOwnProperty(receiverId)) {
                            debug("%s/%s notifying receiver that sender left", socket.id, receiverId);
                            sender.receivers[receiverId].socket.emit('sender_left');
                        }
                    }
                    //closing stream
                    app.removeStream(socket.id);
                    debug("%s sender disconnect", socket.id);
                });

            } else if (socket.handshake.query.role == 'receiver') { // RECEIVER ---------------------------------
                var senderID = socket.handshake.query.senderID;
                var receiverLabel = socket.handshake.query.receiverLabel;

                debug("%s/%s/%s new receiver", senderID, socket.id, receiverLabel);
                var sender = senders[senderID];
                if (typeof sender == "undefined") {
                    error('Error: unkown senderID %s', senderID);
                    socket.emit('alert', 'unkown senderID');
                } else {
                    //keeping reference between sender and receiver
                    sender.receivers[socket.id] ={socket: socket, label: receiverLabel};
                    debug("%s/%s receiver registered ", senderID, socket.id);

                    socket.on('transfer_complete', function(){
                        debug("%s/%s transfer_complete", senderID, socket.id);
                        if(app.removeReceiver(senderID, socket.id)){
                            sender.socket.emit('transfer_complete', socket.id,receiverLabel);
                        }
                    });
                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        debug("%s/%s receiver disconnect", senderID, socket.id);
                        if(app.removeReceiver(senderID, socket.id)){
                            sender.socket.emit('receiver_left', socket.id,receiverLabel);
                            debug("receiver %s has left!", socket.id);
                        }
                        delete sender.receivers[socket.id];
                    });

                    sender.socket.emit('receiver_ready', socket.id,receiverLabel);
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
