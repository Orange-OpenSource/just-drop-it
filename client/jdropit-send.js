"use strict";
function sendFile(isLocal,senderLabel) {

    $("#clipboardcopyok").hide();

    //____ Handling of copy to clipboard with zeroClipboard
    var clip = new ZeroClipboard(document.getElementById("copy-button"));
    clip.on("ready", function () {
        clip.on("copy", function (event) {
            var clipboard = event.clipboardData;
            clipboard.setData("text/plain", 'http://' + receiverUrl);
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


    var socket;
    var receiverUrl;

    //init du socket vers le serveur
    var socketParams = { query: 'role=sender'};
    if (!isLocal)//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    socket = io(socketParams);


    socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });


    var fileToTransfert;

    //soumission du fichier via formulaire
    $('#file').change(function (e) {
        fileToTransfert = e.target.files[0];
        fileIsReady();
        //startUpload(e.target.files);
    });

    //soumission du fichier via drag and drop
    dropZone.on('drop', function (e) {
        if (e.originalEvent.dataTransfer) {
            if (e.originalEvent.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
                /*UPLOAD FILES HERE*/
                this.className = 'upload-drop-zone';
                fileToTransfert = e.originalEvent.dataTransfer.files[0];
                fileIsReady();
            }
        }
    });

    function fileIsReady() {
        $('#filename').html(fileToTransfert.name + " (" + Math.round(fileToTransfert.size / 1024 / 1024) + " Mo)");
        socket.emit('file_ready', { size: fileToTransfert.size,
            name: fileToTransfert.name});
        $('#copyLinkContainer').show(500);
        $('#warning-window').show(500);
        $('#selectFileContainer').hide(500);
    }

    socket.on('receive_url_ready', function (url) {
        receiverUrl = window.location.host + url;
        $('#generatedurl').html("<p>http://" + receiverUrl + " </p> ");
        $('#generatedurlreminder').html("&nbsp;(http://" + receiverUrl + ")");
    });

    socket.on('receiver_ready', function (receiverId,receiverLabel) {
        $('#copyLinkContainer').hide(500);
        $('#transferContainer').show(500);
        startUpload(fileToTransfert, receiverId,receiverLabel);
    });


    //fonction d'upload du fichier
    function startUpload(file, receiverId, receiverLabel) {
        console.log(file);

        if(typeof receiverLabel == "undefined" || receiverLabel.length == 0 ){
            receiverLabel = "unknown receiver"
        }

        var transferContainer = $('#transferContainer');
        /*
         div.col-xs-12
         p The transfer will start as soon as you friend open the link.
         div.progress
         div#transferProgressBar(class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="min-width: 2em;") 0%

         p File:
         span.filename
         */
        var row = $("<div>", {id : "receiver-col-"+receiverId}).addClass("row");
        row.append($("<div>").addClass("col-xs-4").append($("<p>").html(receiverLabel)));
        var transferProgressBar = $("<div>", {role : "progressbar", "aria-valuenow": "0",
            "aria-valuemin" : "0", "aria-valuemax" : "1000", style : "min-width: 2em;"}).addClass("progress-bar progress-bar-striped active").html("0 %");
        row.append($("<div>", {id : "transfertProgresssBar-"+receiverId}).addClass("col-xs-7").append(transferProgressBar));
        var linkRemove = $("<a>", {href : "#"}).append($("<span>").addClass("glyphicon glyphicon-remove"));
        linkRemove.on("click", function(e){
            e.preventDefault();
            row.hide();
        });
        row.append($("<div>", {id : "transfert-"+receiverId+"-remove", hidden : "true"}).addClass("col-xs-1").append(linkRemove));
        transferContainer.append(row);

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
        var progressBarContainer = $('#transfertProgresssBar-'+receiverId);
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass("text-error").html("Receiver left before end of transfer"));
        $("#transfert-"+receiverId+"-remove").show();
        if(typeof receiverLabel != "undefined" && receiverLabel.length != 0 ) {
            receiverLabel=receiverLabel+" "
        }
        jdNotif.notify("Something is wrong", "Apparently your friend "+receiverLabel+"left before the transfer was over")

    });

    socket.on('transfer_complete', function(receiverId,receiverLabel){
        console.log("transfer_complete - "+receiverId);
        var progressBarContainer = $('#transfertProgresssBar-'+receiverId);
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
