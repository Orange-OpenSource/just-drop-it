"use strict";
function SenderHandler(isLocal) {
    this.init(isLocal);
}

SenderHandler.prototype = {

    constructor: SenderHandler,

    init: function (isLocal) {
        this.readWriteOpts = {highWaterMark: Math.pow(2, 21)};// 2 pow 10 = 1024
        this.receiverInfos = [];
        var that = this;

        //init du socket vers le serveur
        this.socketParams = {
            query: 'role=sender',
            transports: ['websocket', 'polling']
        };

        if (!isLocal)//restriction on OPENSHIFT
            this.socketParams.path = "/_ws/socket.io/";
        this.socket = io(this.socketParams);

        this.socket.on('alert', function (errorMsg) {
            displayError("Error: " + errorMsg);
        });

        this.socket.on('connect', function () {
            console.log(this.id + " - " + this.io.engine.transport.name);
        });

        this.socket.on('server_rcv_url_generated', function (url) {
            that.receiverUrl = window.location.host + url;
            $('#generatedurl').html("<p>http://" + that.receiverUrl + " </p> ");
            $('#generatedurlreminder').html("&nbsp;(http://" + that.receiverUrl + ")");
        });


        this.socket.on('server_receiver_ready', function (receiverId, receiverLabel) {
            $('#copyLinkContainer').hide();
            $('#transfertMessage').html("Transfert in progress...");

            //init container
            var transferContainer = $('#transferContainer');
            transferContainer.show();

            var rowReceiverTemplate = $("#rowReceiverTemplate");
            var newRow = rowReceiverTemplate.clone();
            newRow.removeAttr("id");
            newRow.show();
            newRow.children(".col-xs-2").append($("<p>").html(receiverLabel));
            var linkContainer = newRow.children(".col-xs-1");
            var linkRemove = linkContainer.children("a");
            linkRemove.on("click", function (e) {
            e.preventDefault();
            newRow.hide();
            });

            var pbContainer = newRow.children(".col-xs-9");
            var transferProgressBar = pbContainer.find(".progress-bar");

            transferContainer.append(newRow);
            that.receiverInfos[receiverId] = new ReceiverInfo(receiverLabel, pbContainer, transferProgressBar, linkContainer);

            that.startUpload(receiverId,that.fileToTransfer.size);

        });

        this.socket.on('rcv_resume_download', function (receiverId, remainingBytes){
            //TODO clean previous stream
            that.startUpload(receiverId,remainingBytes);
        });

        this.socket.on('server_receiver_left', function (receiverId) {
            var receiverInfo = that.receiverInfos[receiverId];
            var progressBarContainer = receiverInfo.progressBarContainer;
            progressBarContainer.empty();
            progressBarContainer.append($("<p>").addClass("text-error").html("Receiver left before end of transfer"));
            receiverInfo.removeLinkContainer.show();
            jdNotif.notify("Something is wrong", "Apparently your friend " + receiverInfo.label + "left before the transfer was over");

        });
    },

    fileIsReady: function (fileToTransfert) {
        var sizeDisplay = fileToTransfert.size > (1024 * 1024) ? Math.round(fileToTransfert.size / 1024 / 1024) + " Mo" :
            fileToTransfert.size > 1024 ? Math.round(fileToTransfert.size / 1024) + " Ko" : fileToTransfert.size + " o";
        $('#filename').html(fileToTransfert.name + " ( " + sizeDisplay + " )");

        this.fileToTransfer = fileToTransfert;


        this.socket.emit('snd_file_ready', {
            size: fileToTransfert.size,
            name: fileToTransfert.name
        });
        $('#copyLinkContainer').show(500);
        $('#warning-window').show(500);
        $('#selectFileContainer').hide(500);
    },

    startUpload: function (receiverId, remainingBytes) {
        console.log(this.fileToTransfer);
        var transferProgressBar = this.receiverInfos[receiverId].progressBar;

        $('#transfertMessage').html("Transfert in progress...");
        var stream = ss.createStream(this.readWriteOpts);

        // upload a file to the server.
        ss(this.socket).emit('snd_send_file', stream, receiverId, remainingBytes);

        var blobStream = ss.createBlobReadStream(this.fileToTransfer, this.readWriteOpts);

        var size = this.fileToTransfer.size - remainingBytes;
        blobStream.read(size);
        
        var that = this;
        blobStream.on('data', function (chunk) {
            size += chunk.length;
            var progress = Math.floor(size / that.fileToTransfer.size * 100);

            //update progress bar
            //TODO handle pb on multi retries
            transferProgressBar.attr('aria-valuenow', progress);
            transferProgressBar.width(progress + '%');
            transferProgressBar.html(progress + '%');

            console.log("progress = "+progress);
            if (progress >= 100) {
                that.transferComplete(receiverId);
            }
        });

        blobStream.pipe(stream);
    },


    transferComplete: function (receiverId) {
        console.log("transfer_complete - " + receiverId);
        var receiverInfo = this.receiverInfos[receiverId];
        var progressBarContainer = receiverInfo.progressBarContainer;
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass("text-success").html("File sent"));
        receiverInfo.removeLinkContainer.show();

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


    $('#generatedurl').click(function () {
        $('#generatedurl').select();
    });

    $('#generatedurlreminder').click(function () {
        $('#generatedurlreminder').select();
    });

}


/******************************************************************/
function ReceiverInfo (label, progressBarContainer, progressBar, removeLinkContainer) {
    this.init(label, progressBarContainer, progressBar, removeLinkContainer);
};

ReceiverInfo.prototype = {
    constructor: ReceiverInfo,
    init: function (label, progressBarContainer, progressBar, removeLinkContainer) {
        this.label = label;
        if (typeof label != "undefined" && label.length != 0) {
            this.label = label + " "
        }
        this.progressBar = progressBar;
        this.progressBarContainer = progressBarContainer;
        this.removeLinkContainer = removeLinkContainer;

        if (typeof this.label != "undefined" && this.label.length != 0) {
            this.label = this.label + " "
        }

    }
};
