"use strict";
function ReceiverHandler(isLocal, senderId, receiverLabel, fileName, fileSize) {
    this.filename = fileName,
        this.filesize = fileSize,
        this.socket = null,
        this.progressBar = $("#transferProgressBar"),
        this.totalTries = 0,
        this._init(isLocal, senderId, receiverLabel);
    //TODO debug filename
    console.log("filename = " + filename);
    console.log("filesize = " + fileSize);
}

ReceiverHandler.prototype.displayProgress = function (nbByteReceived) {

    var progress = Math.floor((nbByteReceived / this.filesize) * 100);
    console.log("displayProgress="+nbByteReceived+" - "+progress);
    this.progressBar.attr('aria-valuenow', progress);
    this.progressBar.width(progress + '%');
    this.progressBar.html(progress + '%');
};

ReceiverHandler.prototype.downloadComplete = function () {
    jdNotif.notify("Download complete", this.filename + " was transferred correctly");

    $('#completeContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);

    this.socket.close(true);
};


ReceiverHandler.prototype.startDownload = function (url) {
    console.log("start download");
    this.totalTries++;
    var that = this;
    $('#filename').html(this.filename + " (" + Math.round(this.filesize / 1024 / 1024) + " Mo)");
    $.fileDownload(url).fail(function () {
        displayError("Error while downloading file " + this.filename);
    });
};


ReceiverHandler.prototype._init = function (isLocal, senderId, receiverLabel) {
    $('#warning-window').show();
    jdNotif.checkNotifPermissions();
    var that = this;

    var socketParams = {
        query: 'senderID=' + senderId + '&role=receiver&receiverLabel=' + receiverLabel,
        transports: ['websocket', 'polling']
    };

    if (!isLocal)//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    this.socket = io(socketParams);
    this.socket.on('connect', function () {
        console.log(this.id + " - " + this.io.engine.transport.name);
    });


    this.socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });

    this.socket.on('server_stream_ready', function (url) {
        that.startDownload(url);
    });


    this.socket.on('server_sender_left', function () {
        jdNotif.notify("Oh no!", "Apparently your friend left before the transfer was complete");
        $("#errorMessage").html("Sender left before the end of transfer");
        $('#errorContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        that.socket.close(true);
    });

    this.socket.on('server_sent_bytes', function(bytesSent){
        that.displayProgress(bytesSent);
    });

    this.socket.on('server_transfer_complete', function(){
       that.downloadComplete();
    });
};
