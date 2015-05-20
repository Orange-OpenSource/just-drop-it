#!/bin/env node

"use strict";

var http = require('http');
var io = require('socket.io');

var ss = require('socket.io-stream');

var app = require("./app");



var server = http.createServer(app);

//retrieve Kermit variables
var ipAddress = process.env.OPENSHIFT_NODEJS_IP;
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
if (typeof ipAddress === "undefined") {
	//  Log errors on OpenShift but continue w/ 127.0.0.1 - this
	//  allows us to run/test the app locally.
	console.warn('No OPENSHIFT_NODEJS_IP var, using ANY');
	ipAddress = null;
}
//------------------------

//  Start the app on the specific interface (and port).
server.listen(port, ipAddress, function () {
	var mDate = new Date(Date.now());
	console.log('%s: Node server started on %s:%d ...', mDate, ipAddress == null? "*" : ipAddress, port);
});
io = io.listen(server);




var senders = {}; // socketId -> socket
var receivers = {}; // socketId -> socket
var routeMap =   {}; //sendersocketID->receiversocketID

var errorMsg;

// on socket connections
io.on('connection', function (socket) {

	//retrieve username
	socket.userName = socket.handshake.query.userID;


	if (typeof socket.handshake.query.role === "undefined") {

        errorMsg = 'Error, no profile transmitted';
		console.log(errorMsg);
		socket.emit('error', errorMsg);

	} else {
		if (socket.handshake.query.role == 'sender') { // SENDER ---------------------------------

			senders[socket.id] = socket;
			console.log('New sender! ', socket.userName, 'with id : ', socket.id);

			//generate new unique url
			//warn sender that the receiver page is ready
			socket.emit('receive_url_ready',  app.receive_uri_path+app.prepareStream(socket.id));
			console.log('receive_url_ready emitted');

			//ON SEND_FILE EVENT (stream)
			ss(socket).on('send_file', function (stream, data) {

				console.log("someone is sending a file (", data.name, ") size:", data.size);

				//searching for the right receiver socket
				var recSocketId = routeMap[socket.id];
				if (recSocketId == undefined) {
					console.error('Error: routing error');
					socket.emit('alert', 'routing error');
				} else {
					//directly expose stream
					console.log("Expose stream for receiver ", recSocketId);
					//notifying receiver
					receivers[recSocketId].emit('stream_ready', app.receive_uri_path+app.setStreamInformation(socket.id, data.name, data.size, stream), data.name, data.size);
				}
			});

			// TRANSFERT_IN_PROGRESS event
			socket.on('transfert_in_progress', function (progress) {
				//simple routing on the other socket
				receivers[routeMap[socket.id]].emit('transfert_in_progress', progress);
			});

			// DISCONNECT event
			socket.on('disconnect', function () {
				delete senders[socket.id];
				delete routeMap[socket.id];
				console.log("sender ", socket.userName, " has left!");
			});

		} else if (socket.handshake.query.role == 'receiver') { // RECEIVER ---------------------------------
			var senderID = socket.handshake.query.senderID;
			receivers[socket.id] = socket;
			//save mapping between sender socket id and receiver socket id
			routeMap[senderID] = socket.id;

			console.log('New receiver ', socket.userName, '/', socket.id);
			console.log('Is waiting for sender', senderID);
			var senderSocket = senders[senderID];
			if (senderSocket == undefined) {
				console.error('Error: unkown senderID');
				socket.emit('alert', 'unkown senderID');
			} else {
				console.log('telling receiver that the connection was established');
				socket.emit('connection_ready', senderSocket.userName);
				console.log('telling the sender that the receiver is ready');
				senderSocket.emit('receiver_ready', socket.userName);
			}
            socket.on('transfer_complete', function(){
                app.streamCompleted(senderID);
                senderSocket.emit('transfer_complete');
            });
			// DISCONNECT event
			socket.on('disconnect', function () {
				delete receivers[socket.id];
				console.log("receiver ", socket.userName, " has left!");
			});


		} else {
            errorMsg = 'Error, unknown profile';
			console.error(errorMsg);
			io.emit('error', errorMsg);
		}
	}


});




