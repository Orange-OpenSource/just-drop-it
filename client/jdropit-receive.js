"use strict";
function ReceiverHandler(isLocal, senderId, receiverLabel, fileName, fileSize) {
    //TODO check if old IE version, for blob compatibility
    this.isIELessThan10 = false,
        this.filename = fileName,
        this.filesize = fileSize,
        this.socket = null,
        this.progressBar = null,
        this.storedResponses = [],
        this.storedBytes = 0,
        this.retryTimeout = 2000,
        this._init(isLocal, senderId, receiverLabel);
    console.log("filename = " + filename);
    console.log("filesize = " + fileSize);
}

ReceiverHandler.prototype.displayProgress = function (progress) {
    var transferProgressBar = $('#transferProgressBar');
    transferProgressBar.attr('aria-valuenow', progress);
    transferProgressBar.width(progress + '%');
    transferProgressBar.html(progress + '%');
};

ReceiverHandler.prototype.downloadComplete = function (response) {
    jdNotif.notify("Download complete", this.filename + " was transferred correctly");

    $('#completeContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);

    var objectUrl = window.URL.createObjectURL(response);
    var anchor = $('<a></a>', {download: this.filename, 'href': objectUrl}).html("Click here to save your file again");
    $("#completeContainer").append(anchor);
    //jquery anchor.click() won't work -> need to use the DOM method
    anchor[0].click();

    this.socket.emit('rcv_transfer_complete');
    this.socket.close(true);
};


ReceiverHandler.prototype.startDownload = function (url) {
    console.log("start download");
    var that = this;

    $('#filename').html(this.filename + " (" + Math.round(this.filesize / 1024 / 1024) + " Mo)");
    if (this.isIeLessThan10) {
        //"old way" : Tentative avec jquery.fileDownload
        $.fileDownload(url).fail(function () {
            displayError("Error while downloading file " + this.filename);
        })
    } else {
        //on utilise blob, ce qui permettra en plus de faire de la ressoumission
        var xhr = new XMLHttpRequest();
        var lastResponse;
        var lastBytesLoaded;
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = function (e) {
            if (this.status == 200) {
                that.downloadComplete(this.response);
            } else {
                displayError("Error: Invalid status code" + this.status);
            }
        };
        xhr.onprogress = function (e) {
            var percentComplete = Math.floor((e.loaded / e.total) * 100);
            that.displayProgress(percentComplete);
            lastResponse = e.target.response;
            lastBytesLoaded = e.loaded;
        };
        xhr.onerror = function (e) {
            console.log("Error fetching " + url + " retrying ");
            that.storedResponses.push(lastResponse);
            that.resumeDownload(e.total - lastBytesLoaded);
        };

        xhr.send();
    }
};


ReceiverHandler.prototype.resumeDownload = function (remainingBytes) {
    console.log("resuming for " + remainingBytes + " bytes");
    var that = this;
    setTimeout(function () {
        console.log("retarting download");
        that.socket.emit("rcv_resume_download",remainingBytes);
    }, that.retryTimeout);

};

ReceiverHandler.prototype._init = function (isLocal, senderId, receiverLabel) {
    $('#warning-window').show();
    jdNotif.checkNotifPermissions();
    var that = this;

    var socketParams = {
        query: 'senderID=' + senderId + '&role=receiver&receiverLabel=' + receiverLabel,

        transports: ['websocket', 'polling']
    };

    console.log(socketParams);

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

};
