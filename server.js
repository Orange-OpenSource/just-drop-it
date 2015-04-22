#!/bin/env node
"use strict";


var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
    // res.setHeader('Content-Type', 'text/html');
  res.sendfile('send.html');
});


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
     var errorMsg = 'Erreur, pas de rôle transmis';
     console.log(errorMsg);
     io.emit('error',errorMsg);
 }else if(socket.handshake.query.role == 'sender'){
     senders[socket.id] = socket;
     console.log('New sender! ', socket.userID);
    console.log('with id : ', socket.id);
     
     var newReceiverUrl = '/'+socket.id;
    
    app.get(newReceiverUrl, function(req, res){
       res.send('<h1>Hello world</h1>');
    });
     
     io.emit('receive_url_ready',newReceiverUrl)
     console.log('receive_url_ready emitted');
     
 }
  
 
    
    
    
    

  io.emit('onlineUsers', onlineUsers());

  socket.on('disconnect', function() {
    delete connections[socket.userID];
    io.emit('onlineUsers', onlineUsers());
    console.log(socket.userID, " has left!");
  });

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
