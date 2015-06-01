#!/bin/env node

"use strict";
var defaultDebugMode =   "app:*";
if(typeof process.env.DEBUG == "undefined"){
    console.log("Adding DEBUG variable to "+defaultDebugMode);
    process.env.DEBUG=defaultDebugMode;
}else{
    console.log("DEBUG already set to "+defaultDebugMode);
}


var http = require('http');
var io = require('socket.io');

var ss = require('socket.io-stream');
var debug = require('debug')('app:server');
var error = require('debug')('app:routes:receive');
var app = require("./app");

debug.log = console.log.bind(console);

var server = http.createServer(app);

//retrieve Kermit variables
var ipAddress = process.env.OPENSHIFT_NODEJS_IP;
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
if (typeof ipAddress === "undefined") {
	//  Log errors on OpenShift but continue w/ 127.0.0.1 - this
	//  allows us to run/test the app locally.
    error('No OPENSHIFT_NODEJS_IP var, using ANY');
	ipAddress = null;
}
//------------------------

//  Start the app on the specific interface (and port).
server.listen(port, ipAddress, function () {
	var mDate = new Date(Date.now());
    debug('%s: Node server started on %s:%d ...', mDate, ipAddress == null? "*" : ipAddress, port);
});
io = io.listen(server);




var senders = {}; // socketId -> socket
var receivers = {}; // socketId -> socket

var errorMsg;

// on socket connections
io.on('connection', function (socket) {

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
			io.emit('error', errorMsg);
		}
	}


});




