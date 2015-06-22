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


    var senders = {}; // socketId -> socket
    var receivers = {}; // socketId -> socket

    var errorMsg;

    // on socket connections
    socketIoServer.on('connection', function (socket) {

        //retrieve username
        socket.userName = socket.handshake.query.userID;


        if (typeof socket.handshake.query.role === "undefined") {

            errorMsg = 'Error, no profile transmitted';
            error(errorMsg);
            socket.emit('error', errorMsg);

        } else {
            if (socket.handshake.query.role == 'sender') { // SENDER ---------------------------------

                senders[socket.id] = {socket: socket, receiver: null};
                debug('New sender! %s with id : %s', socket.userName, socket.id);

                //generate new unique url
                //warn sender that the receiver page is ready
                socket.emit('receive_url_ready',  app.receive_uri_path+app.prepareStream(socket.id));
                debug('receive_url_ready emitted');

                //ON SEND_FILE EVENT (stream)
                ss(socket).on('send_file', function (stream, data) {

                    debug("someone is sending a file (%s) size:%d",data.name, data.size);

                    //searching for the right receiver socket
                    var sender = senders[socket.id];
                    if (typeof sender == "undefined" ||typeof sender.receiver == "undefined") {
                        error('Error: routing error');
                        socket.emit('alert', 'routing error');
                    } else {
                        //directly expose stream
                        debug("Expose stream for receiver %s", sender.receiver.id);
                        //notifying receiver
                        sender.receiver.emit('stream_ready', app.receive_uri_path+app.setStreamInformation(socket.id, data.name, data.size, stream), data.name, data.size);
                    }
                });

                // TRANSFERT_IN_PROGRESS event
                socket.on('transfert_in_progress', function (progress) {
                    //simple routing on the other socket
                    senders[socket.id].receiver.emit('transfert_in_progress', progress);
                });

                // DISCONNECT event
                socket.on('disconnect', function () {
                    var sender = senders[socket.id];
                    delete senders[socket.id];
                    if( sender.receiver != null && typeof receivers[sender.receiver.id] != "undefined"){
                        sender.receiver.emit('sender_left');
                        //closing stream
                        app.streamCompleted(socket.id, true);
                    }
                    debug("sender %s has left!", socket.userName);
                });

            } else if (socket.handshake.query.role == 'receiver') { // RECEIVER ---------------------------------
                var senderID = socket.handshake.query.senderID;


                debug('New receiver %s/%s', socket.userName, socket.id);
                debug('Is waiting for sender %s', senderID);
                var sender = senders[senderID];
                if (typeof sender == "undefined") {
                    error('Error: unkown senderID');
                    socket.emit('alert', 'unkown senderID');
                } else {
                    //keeping reference between sender and receiver
                    receivers[socket.id] = {socket : socket, sender : sender.socket};
                    sender.receiver = socket;


                    debug('telling receiver that the connection was established');
                    socket.emit('connection_ready', sender.socket.userName);
                    debug('telling the sender that the receiver is ready');

                    sender.socket.emit('receiver_ready', socket.userName);

                    socket.on('transfer_complete', function(){
                        app.streamCompleted(senderID);
                        sender.socket.emit('transfer_complete');
                    });
                    // DISCONNECT event
                    socket.on('disconnect', function () {
                        var receiver = receivers[socket.id];
                        delete receivers[socket.id];
                        if(typeof senders[receiver.sender.id] != "undefined"){
                            receiver.sender.emit('receiver_left');
                            app.streamCompleted(senderID, true);
                        }
                        debug("receiver %s has left!", socket.userName);

                    });
                }
            } else {
                errorMsg = 'Error, unknown profile';
                error(errorMsg);
                socket.emit('error', errorMsg);
            }
        }
    });
    return socketIoServer;

}
