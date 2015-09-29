"use strict";
function SenderHandler(isLocal) {
    this.init(isLocal);
}

SenderHandler.prototype = {

    constructor: SenderHandler,

    init: function (isLocal) {
        this.bytesPerChunk = 8 * 1024 * 1024; // 1MB chunk sizes.
        this.readWriteOpts = {highWaterMark: Math.pow(2, 21)};// 2 pow 10 = 1024
        this.minChannel = 5;
        this.nbPacket = 0;
        this.fileSlices = [];
        this.receiverInfos = [];

        var that = this;

        //init du socket vers le serveur
        this.socketParams = {
            query: 'role=sender',
            'multiplex': false /*so that calling a new socket doesn't return the previous cached one */,
            transports:  [ 'websocket', 'polling' ]
        };

        if (!isLocal)//restriction on OPENSHIFT
            this.socketParams.path = "/_ws/socket.io/";
        this.socket = io(this.socketParams);

        this.socket.on('alert', function (errorMsg) {
            displayError("Error: " + errorMsg);
        });

        this.socket.on('connect', function() {
            console.log(this.id+" - "+this.io.engine.transport.name);
        });

        this.socket.on('server_receive_url_ready', function (url) {
            that.receiverUrl = window.location.host + url;
            $('#generatedurl').html("<p>http://" + that.receiverUrl + " </p> ");
            $('#generatedurlreminder').html("&nbsp;(http://" + that.receiverUrl + ")");
        });


        this.socket.on('serveur_receiver_ready', function (receiverId, receiverLabel) {
            $('#copyLinkContainer').hide();
            $('#transfertMessage').html("Transfert in progress...");

            /*****TODO AVANT CA RESSEMBLAIT A CA
            var row = $("<div>", {id : getRowId(receiverId)}).addClass("row");
            row.append($("<div>").addClass("col-xs-4").addClass("receiver-label").append($("<p>").html(receiverLabel)));
            var transferProgressBar = $("<div>", {id : getTransfertBarId(receiverId), role : "progressbar", "aria-valuenow": "0", "aria-valuemin" : "0", "aria-valuemax" : "1000", style : "min-width: 2em;"}).addClass("progress-bar progress-bar-striped active").html("0 %");
            row.append($("<div>", {id : getTransfertBarContainerId(receiverId)}).addClass("col-xs-7").append(transferProgressBar));
            var linkRemove = $("<a>", {href : "#"}).append($("<span>").addClass("glyphicon glyphicon-remove"));
            linkRemove.on("click", function(e){
                e.preventDefault();
                row.hide();
            });
            row.append($("<div>", {id : "transfert-"+receiverId+"-remove", hidden : "true"}).addClass("col-xs-1").append(linkRemove));
            transferContainer.append(row);

            /***/

            //init container
            var transferContainer = $('#transferContainer');
            transferContainer.show();

            var rowReceiverTemplate = $("#rowReceiverTemplate");
            var newRow = rowReceiverTemplate.clone();
            newRow.attr("id", "receiver-col-" + receiverId);
            newRow.children(".col-xs-4").append($("<p>").html(receiverLabel));
            var linkContainer = newRow.children(".col-xs-1");
            var linkRemove = linkContainer.children("a");
            linkRemove.on("click", function (e) {
                e.preventDefault();
                newRow.hide();
            });

            var pbContainer = newRow.children(".col-xs-7");

            var templateBarContainer = rowReceiverTemplate.children(".col-xs-7");
            transferContainer.append(newRow);




           that.receiverInfos[receiverId] = new ReceiverInfo(receiverLabel, pbContainer, clusterProgressBar, linkContainer, that.nbPacket, sockets);


        });

        this.socket.on('server_receiver_left', function (receiverId, receiverLabel) {
            var receiverInfo = that.receiverInfos[receiverId];
            var progressBarContainer = receiverInfo.progressBarContainer;
            progressBarContainer.empty();
            progressBarContainer.append($("<p>").addClass("text-error").html("Receiver left before end of transfer"));
            receiverInfo.removeLinkContainer.show();
            receiverInfo.dataSocketPool.closeAll();
            if (typeof receiverLabel != "undefined" && receiverLabel.length != 0) {
                receiverLabel = receiverLabel + " "
            }
            jdNotif.notify("Something is wrong", "Apparently your friend " + receiverLabel + "left before the transfer was over");

        });

        this.socket.on('rcv_packet_received', function (receiverId, packetIndex) { //TODO add data-socketId in args
            that.receiverInfos[receiverId].progressBar.fillCluster(packetIndex);
            var totalReceived = that.receiverInfos[receiverId].addPacketReceived(packetIndex);
            that.receiverInfos[receiverId].dataSocketPool.release(packetIndex);
            console.log("totalReceived="+totalReceived);
            if (totalReceived == that.fileSlices.length) {
                that.transferComplete(receiverId);
            } else {
                that.sendNextPacket(receiverId);
            }
        });

        this.socket.on('rcv_packet_failed', function (receiverId, packetIndex) {
            //TODO UI feedback on network troubles?
            that.receiverInfos[receiverId].dataSocketPool.release(packetIndex);
            that.sendPacket(packetIndex, receiverId)
        });

    },

    fileIsReady: function (fileToTransfert) {
        var sizeDisplay = fileToTransfert.size > (1024 * 1024) ? Math.round(fileToTransfert.size / 1024 / 1024) + " Mo" :
            fileToTransfert.size > 1024 ? Math.round(fileToTransfert.size / 1024) + " Ko" : fileToTransfert.size + " o";
        $('#filename').html(fileToTransfert.name + " ( " + sizeDisplay + " )");

        var SIZE = fileToTransfert.size;
        var start = 0;
        var end = this.bytesPerChunk;
        this.nbPacket = 0;
        while (start < SIZE) {
            this.fileSlices.push(fileToTransfert.slice(start, end));
            start = end;
            end = start + this.bytesPerChunk;
            this.nbPacket++;
        }
        this.socket.emit('snd_file_ready', {
            size: fileToTransfert.size,
            name: fileToTransfert.name,
            nbPacket: this.nbPacket
        });
        $('#copyLinkContainer').show(500);
        $('#warning-window').show(500);
        $('#selectFileContainer').hide(500);
    },

    sendNextPacket: function (receiverId) {
        var nextPacketIndex = this.receiverInfos[receiverId].getNextPacketIndex();
        if(typeof nextPacketIndex != "undefined")
            this.sendPacket(nextPacketIndex, receiverId);
    },

    sendPacket: function (packetIndex, receiverId) {
        var fileSlice = this.fileSlices[packetIndex];
        if (typeof fileSlice == "undefined") {
            console.error("Unknown packet " + packetIndex + "/" + this.nbPacket);
        } else {
            console.log("sendPacket - send packet " + (packetIndex+1) + "/" + this.nbPacket);
            var stream = ss.createStream(this.readWriteOpts);
            //retrieve free socket
            var dataSocket=this.receiverInfos[receiverId].dataSocketPool.pull(packetIndex);

            // upload a file to the server.
            ss(dataSocket).emit('snd_send_packet', this.socket.id, stream, receiverId, packetIndex, fileSlice.size);
            var blobStream = ss.createBlobReadStream(fileSlice, this.readWriteOpts);
            blobStream.pipe(stream);
        }
    },

    transferComplete: function (receiverId) {
        console.log("transfer_complete - " + receiverId);
        var receiverInfo = this.receiverInfos[receiverId];
        var progressBarContainer = receiverInfo.progressBarContainer;
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass("text-success").html("File sent"));
        receiverInfo.removeLinkContainer.show();
        receiverInfo.dataSocketPool.closeAll();

        jdNotif.notify("Transfer complete", "your friend " + this.receiverInfos[receiverId].label + "correctly received your file");

        this.socket.emit("snd_transfer_complete", receiverId);
    }
};



function sendFile(isLocal) {

    var senderHandler = new SenderHandler(isLocal, senderHandler);

    $("#clipboardcopyok").hide();
    jdNotif.checkNotifPermissions();
    //____ Handling of copy to clipboard with zeroClipboard
    var clip = new ZeroClipboard(document.getElementById("copy-button"));
    clip.on("ready", function () {
        clip.on("copy", function (event) {
            var clipboard = event.clipboardData;
            clipboard.setData("text/plain", 'http://' + senderHandler.receiverUrl);
        });
        clip.on("aftercopy", function () {
            $("#clipboardcopyok").show(300);
        });
    });


    var dropZone = $('#drop-zone');
    //----- Handling drag and drop zone style
    dropZone.on('dragover', function () {
        this.className = 'upload-drop-zone drop';
        return false;
    });

    dropZone.on('dragleave', function () {
        this.className = 'upload-drop-zone';
        return false;
    });




    //soumission du fichier via formulaire
    $('#file').change(function (e) {
        senderHandler.fileIsReady(e.target.files[0]);
    });

    //soumission du fichier via drag and drop
    dropZone.on('drop', function (e) {
        if (e.originalEvent.dataTransfer) {
            if (e.originalEvent.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
                this.className = 'upload-drop-zone';
                senderHandler.fileIsReady(e.originalEvent.dataTransfer.files[0]);
            }
        }
    });


    function getRowId(receiverId){
        return "receiver-col-"+receiverId;
    }


    function getTransfertBarId(receiverId){
        return "transfertProgresssBar-"+receiverId;
    }

    function getTransfertBarContainerId(receiverId){
        return "transfertProgresssBarContainer-"+receiverId;
    }

    socket.on('receiver_ready', function (receiverId, receiverLabel) {
        $('#copyLinkContainer').hide(500);
        $('#transferContainer').show(500);

        //init container

        var transferContainer = $('#transferContainer');
        var row = $("<div>", {id : getRowId(receiverId)}).addClass("row");
        row.append($("<div>").addClass("col-xs-4").addClass("receiver-label").append($("<p>").html(receiverLabel)));
        var transferProgressBar = $("<div>", {id : getTransfertBarId(receiverId), role : "progressbar", "aria-valuenow": "0", "aria-valuemin" : "0", "aria-valuemax" : "1000", style : "min-width: 2em;"}).addClass("progress-bar progress-bar-striped active").html("0 %");
        row.append($("<div>", {id : getTransfertBarContainerId(receiverId)}).addClass("col-xs-7").append(transferProgressBar));
        var linkRemove = $("<a>", {href : "#"}).append($("<span>").addClass("glyphicon glyphicon-remove"));
        linkRemove.on("click", function(e){
            e.preventDefault();
            row.hide();
        });
        row.append($("<div>", {id : "transfert-"+receiverId+"-remove", hidden : "true"}).addClass("col-xs-1").append(linkRemove));
        transferContainer.append(row);

        startUpload(fileToTransfert, receiverId,transferProgressBar);
    });




    socket.on("restart_download", function(receiverId, receiverLabel){
        //re init container
        console.log("restart_download - "+receiverId);
        $("#"+getRowId(receiverId)+" .receiver-label").html(receiverLabel+ " (experiencing network issues, download restarted)");
        var transferProgressBar = $("#"+getTransfertBarId(receiverId));
        transferProgressBar.attr('aria-valuenow', 0);
        transferProgressBar.width('0%');
        transferProgressBar.html('0%');
        startUpload(fileToTransfert, receiverId,transferProgressBar);
    });


    //fonction d'upload du fichier
    function startUpload(file, receiverId, transferProgressBar) {
        console.log(file);

        var readWriteOpts = {highWaterMark: Math.pow(2,21)};

        $('#transfertMessage').html("Transfert in progress...");
        var stream = ss.createStream(readWriteOpts);

        // upload a file to the server.
        ss(socket).emit('send_file', stream, receiverId,senderLabel);

        var blobStream = ss.createBlobReadStream(file,readWriteOpts);
        var size = 0;

        blobStream.on('data', function (chunk) {
            size += chunk.length;
            //console.log(Math.floor(size / file.size * 100) + '%');
            var progress = Math.floor(size / file.size * 100);

            socket.emit('transfer_in_progress', progress, receiverId);

            //update progress bar

            transferProgressBar.attr('aria-valuenow', progress);
            transferProgressBar.width(progress + '%');
            transferProgressBar.html(progress + '%');
        });


        blobStream.pipe(stream);
    }

    socket.on('receiver_left', function(receiverId,receiverLabel){
        var progressBarContainer = $('#'+getTransfertBarContainerId(receiverId));
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass("text-error").html("Receiver left before end of transfer"));
        $("#transfert-"+receiverId+"-remove").show();
        if(typeof receiverLabel != "undefined" && receiverLabel.length != 0 ) {
            receiverLabel=receiverLabel+" "
        }
        jdNotif.notify("Something is wrong", "Apparently your friend "+receiverLabel+"left before the transfer was over");

    });

    socket.on('receiver_cancel_too_many_retries', function(receiverId,receiverLabel){
        var progressBarContainer = $('#'+getTransfertBarContainerId(receiverId));
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass("text-error").html("Transfer canceled because of too many network failures"));
        $("#transfert-"+receiverId+"-remove").show();
        if(typeof receiverLabel != "undefined" && receiverLabel.length != 0 ) {
            receiverLabel=receiverLabel+" "
        }
        jdNotif.notify("Something is wrong", "Apparently your friend "+receiverLabel+" had network failures, transfer has been canceled");

    });

    socket.on('transfer_complete', function(receiverId,receiverLabel){
        console.log("transfer_complete - "+receiverId);
        var progressBarContainer = $('#'+getTransfertBarContainerId(receiverId));
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass("text-success").html("File sent"));
        $("#transfert-"+receiverId+"-remove").show();
        if(typeof receiverLabel != "undefined" && receiverLabel.length != 0 ) {
            receiverLabel=receiverLabel+" "
        }
        jdNotif.notify("Transfer complete", "your friend "+receiverLabel+"correctly received your file");
    });

    $('#generatedurl').click(function () {
        $('#generatedurl').select();
    });

    $('#generatedurlreminder').click(function () {
        $('#generatedurlreminder').select();
    });


}
