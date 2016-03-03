"use strict";
function SenderHandler(isLocal) {
    this.init(isLocal);
}

SenderHandler.prototype = {

    constructor: SenderHandler,

    init: function (isLocal) {
        this.readWriteOpts = {highWaterMark: Math.pow(2, 21)};// 2 pow 10 = 1024
        this.receiverInfos = {};
        var that = this;

        //init du socket vers le serveur
        this.socketParams = {
            query: 'role=sender',
            transports: ['polling']
        };

        if (!isLocal)//restriction on OPENSHIFT
            this.socketParams.path = "/_ws/socket.io/";
        this.socket = io(this.socketParams);


        this.socket.on('connect', function () {
            console.log(this.id + " - " + this.io.engine.transport.name);

            function handleError(errorMessage) {
                appendError(errorMessage);
                $.each(that.receiverInfos, function (receiverId, receiverInfo) {
                    if (receiverInfo.active) {
                        console.log("Receiver id " + receiverId + " failed");
                        that.transfertEnded(receiverId, true, "your friend did not received the file", "File not sent");
                    } else {
                        console.log("Receiver id " + receiverId + " not active");
                    }
                });
            }

            that.socket.on('error', function (errorMsg) {
                console.log("socket - error - " + errorMsg);
                handleError("Error: " + errorMsg);
            });

            that.socket.on('disconnect', function () {
                console.log("socket - disconnect");
                handleError("Error: you have been disconnected");
            });
        });

        this.socket.on('server_rcv_url_generated', function (url) {
            that.receiverUrl = window.location.host + url;
            $('#generatedurl').html("<p>http://" + that.receiverUrl + " </p> ");
            $('#generatedurlreminder').html("&nbsp;(http://" + that.receiverUrl + ")");
        });


        this.socket.on('server_receiver_ready', function (receiverId) {
            $('#copyLinkContainer').hide();
            $('#transfertMessage').html("Transfert in progress...");

            //init container
            var transferContainer = $('#transferContainer');
            transferContainer.show();

            var rowReceiverTemplate = $("#rowReceiverTemplate");
            var newRow = rowReceiverTemplate.clone();
            newRow.removeAttr("id");
            newRow.show();
            var linkContainer = newRow.children(".col-xs-1");
            var linkRemove = linkContainer.children("a");
            linkRemove.on("click", function (e) {
                e.preventDefault();
                newRow.hide();
            });

            var pbContainer = newRow.children(".col-xs-9");
            var transferProgressBar = pbContainer.find(".progress-bar");

            transferContainer.append(newRow);
            that.receiverInfos[receiverId] = new ReceiverInfo(pbContainer, transferProgressBar, linkContainer);

            that.startUpload(receiverId);

        });


        this.socket.on('server_receiver_left', function (receiverId) {
            var receiverInfo = that.receiverInfos[receiverId];
            receiverInfo.deactivate(true);
            var progressBarContainer = receiverInfo.progressBarContainer;
            progressBarContainer.empty();
            progressBarContainer.append($("<p>").addClass("text-error").html("Receiver left before end of transfer"));
            receiverInfo.removeLinkContainer.show();
            jdNotif.notify("Something is wrong", "Apparently your friend left before the transfer was over");

        });

        this.socket.on('server_sent_percent', function(receiverId, percent){
            that.displayProgress(receiverId, percent);
        });

        this.socket.on('server_transfer_complete', function (receiverId) {
            that.transfertEnded(receiverId, false, "your friend correctly received your file", "File sent");
        });


        this.socket.on('server_transfer_timeout', function (receiverId) {
            that.transfertEnded(receiverId, true, "your friend failed to download", "File not sent");
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

    startUpload: function (receiverId) {
        console.log(this.fileToTransfer);
        var receiverInfo = this.receiverInfos[receiverId];


        $('#transfertMessage').html("Transfert in progress...");
        var stream = ss.createStream(this.readWriteOpts);

        // upload a file to the server.
        ss(this.socket).emit('snd_send_file', stream, receiverId);

        var blobStream = ss.createBlobReadStream(this.fileToTransfer, this.readWriteOpts);

        receiverInfo.activate(stream);

        blobStream.pipe(stream);

    },

    displayProgress : function(receiverId, percent){
        console.log("displayProgress - "+receiverId+" - "+percent);
        var transferProgressBar = this.receiverInfos[receiverId].progressBar;
        //update progress bar
        transferProgressBar.attr('aria-valuenow', percent);
        transferProgressBar.width(percent + '%');
        transferProgressBar.html(percent + '%');
    },

    transfertEnded: function (receiverId, isError, notif, message) {
        var receiverInfo = this.receiverInfos[receiverId];
        receiverInfo.deactivate(isError);
        var progressBarContainer = receiverInfo.progressBarContainer;
        progressBarContainer.empty();
        progressBarContainer.append($("<p>").addClass(isError ? "text-success" : "text-error").html(message));
        receiverInfo.removeLinkContainer.show();

        jdNotif.notify("Transfer ended", notif);

    }
};


function sendFile(isLocal) {

    var senderHandler = new SenderHandler(isLocal);

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
function ReceiverInfo(progressBarContainer, progressBar, removeLinkContainer) {
    this.init(progressBarContainer, progressBar, removeLinkContainer);
};

ReceiverInfo.prototype = {
    constructor: ReceiverInfo,
    init: function (progressBarContainer, progressBar, removeLinkContainer) {
        this.active = false;
        this.stream = null;
        this.progressBar = progressBar;
        this.progressBarContainer = progressBarContainer;
        this.removeLinkContainer = removeLinkContainer;
    },
    activate: function (stream) {
        this.stream = stream;
        this.active = true;
    },
    deactivate: function (closeStream) {
        if (this.stream != null && closeStream) {
            this.stream.destroy();
        }
        this.stream = null;
        this.active = false;
    }
};
