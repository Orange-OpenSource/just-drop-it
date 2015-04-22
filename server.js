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

app.get('/thankyou', function(req, res){
  res.send('<h1>Thank you!</h1>');
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

var senders = {}; // socketId -> socket
var receivers = {}; // socketId -> socket
var routeMap = {}; //sendersocketID->receiversocketID


io.on('connection', function (socket){

  socket.userName = socket.handshake.query.userID;
    
    
 if(socket.handshake.query.role == undefined){
     var errorMsg = 'Error, no profile transmitted';
     console.log(errorMsg);
     socket.emit('error',errorMsg);
 }else if(socket.handshake.query.role == 'sender'){
     senders[socket.id] = socket;
     console.log('New sender! ', socket.userName);
    console.log('with id : ', socket.id);
     
     var newReceiverUrl = '/'+socket.id;
    
    app.get(newReceiverUrl, function(req, res){
       res.sendfile('receive.html');
    });
     
     socket.emit('receive_url_ready',newReceiverUrl)
     console.log('receive_url_ready emitted');
     
   
     
      ss(socket).on('send_file', function(stream, data) {
        console.log("someone is sending a file (",data.name,") size:",data.size);
        /* var filename = path.basename(data.name);
          console.log("Apparently the file is named ",filename);
        stream.pipe(fs.createWriteStream(filename));
           console.log("streaming..");*/
          
          
          console.log("searching for the right receiver socket");
           var recSocketId = routeMap[socket.id]
            if(recSocketId == undefined){
                console.error('Error: routing error')
                socket.emit('alert','routing error');  
            }else{

               //other way: expose stream 
                console.log("Expose stream for receiver ",recSocketId);
                var streamUrl = socket.id+'data';
                 console.log(" url: ",streamUrl);
                  app.get('/'+streamUrl, function(req, res){
                    res.setHeader('Content-Type', 'application/octet-stream');
                        res.setHeader('Content-Length', data.size);
                      res.setHeader('Content-Disposition','attachment; filename="'+data.name+'"');
                    stream.pipe(res);
                });
                 console.log(" warning receiver");
                receivers[recSocketId].emit('stream_ready', streamUrl);
  
            }
    });
     
      socket.on('transfert_in_progress', function(progress) {
           console.log("transfering progress", progress);
           receivers[routeMap[socket.id]].emit('transfert_in_progress',progress);
    });
     
      socket.on('disconnect', function() {
        delete senders[socket.id];
        delete routeMap[socket.id];
        console.log("sender " , socket.userName, " has left!");   
    });
     
 }else if(socket.handshake.query.role == 'receiver'){
     receivers[socket.id] = socket
    
     var senderID = socket.handshake.query.senderID;
     
     //save mapping between sender socket id and receiver socket id
     routeMap[senderID] = socket.id
      
     console.log('New receiver ',socket.userName,'/',socket.id);
     console.log('Is waiting for sender',senderID)
      var senderSocket = senders[senderID]
      if(senderSocket == undefined){
          console.error('Error: unkown senderID')
          socket.emit('alert','unkown senderID');  
      }else{
          console.log('telling receiver that the connection was established');
          socket.emit('connection_ready',senderSocket.userName);
          console.log('telling the sender that the receiver is ready');
          senderSocket.emit('receiver_ready',socket.userName);
      }
     
     
    socket.on('disconnect', function() {
        delete receivers[socket.id];
        console.log("receiver ", socket.userName, " has left!");    
    });
     
   
     
 }else{
    var errorMsg = 'Error, unknown profile';
     console.error(errorMsg);
     io.emit('error',errorMsg);  
 }
  
 
    
    
    
    

 

 

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
