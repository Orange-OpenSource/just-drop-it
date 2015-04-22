#!/bin/env node
"use strict";

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var ss = require('socket.io-stream');

//TODO check if necessary once the server doesn't write the file
var path = require('path');
var fs = require("fs");

app.get('/', function(req, res){
    // res.setHeader('Content-Type', 'text/html');
  res.sendfile('send.html');
});

app.use('/js', express.static(__dirname + '/public/js'));


//retrieve Kermit variables
var ipaddress = process.env.OPENSHIFT_NODEJS_IP;
var port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;
if (typeof ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            ipaddress = "127.0.0.1";
};

//------------------------
var connections = {};

var senders = {};

var onlineUsers = function(){
  var users = [];
  for(var userID in connections) users.push(userID);

  return users;
};


io.on('connection', function (socket){

  socket.userID = socket.handshake.query.userID;
    
    
 if(socket.handshake.query.role == undefined){
     var errorMsg = 'Error, no profile transmitted';
     console.log(errorMsg);
     socket.emit('error',errorMsg);
 }else if(socket.handshake.query.role == 'sender'){
     senders[socket.id] = socket;
     console.log('New sender! ', socket.userID);
    console.log('with id : ', socket.id);
     
     var newReceiverUrl = '/'+socket.id;
    
    app.get(newReceiverUrl, function(req, res){
       res.sendfile('receive.html');
    });
     
     socket.emit('receive_url_ready',newReceiverUrl)
     console.log('receive_url_ready emitted');
     
    socket.on('disconnect', function() {
        delete senders[socket.userID];
        console.log("sender " , socket.userID, " has left!");   
    });
     
      ss(socket).on('send_file', function(stream, data) {
        console.log("someone is sending a file");
         var filename = path.basename(data.name);
          console.log("Apparently the file is named ",filename);
        stream.pipe(fs.createWriteStream(filename));
           console.log("streaming..");
    });
     
 }else if(socket.handshake.query.role == 'receiver'){
     var senderID = socket.handshake.query.senderID;
     console.log('New receiver ',socket.userID,'/',socket.id);
     console.log('Is waiting for sender',senderID)
      var senderSocket = senders[senderID]
      if(senderSocket == undefined){
          console.error('Error: unkown senderID')
          socket.emit('alert','unkown senderID');  
      }else{
          console.log('telling receiver that the connection was established');
          socket.emit('connection_ready',senderSocket.userID);
          console.log('telling the sender that the receiver is ready');
          senderSocket.emit('receiver_ready',socket.userID);
      }
     
    socket.on('disconnect', function() {
        console.log("receiver ", socket.userID, " has left!");    
    });
     
   
     
 }else{
    var errorMsg = 'Error, unknown profile';
     console.error(errorMsg);
     io.emit('error',errorMsg);  
 }
  
 
    
    
    
    

  io.emit('onlineUsers', onlineUsers());

 

  socket.on('message', function(msg){
    var outgoingSocket = connections[msg.to]
    socket.emit('message', msg);
    outgoingSocket.emit('message', msg);
  });
});




//  Start the app on the specific interface (and port).
http.listen(port, ipaddress, function() {
     console.log('%s: Node server started on %s:%d ...', Date(Date.now() ), ipaddress, port);
});
