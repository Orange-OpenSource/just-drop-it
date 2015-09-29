"use strict";
function ReceiverHandler(isLocal, senderId, receiverLabel, fileName, fileSize) {
    //TODO check if old IE version, for blob compatibility
    this.isIELessThan10 = false,
        this.filename = fileName,
        this.filesize = fileSize,
        this.socket = null,
        this.dataHandler = new FileSliceHandler(nbPacket),
        this.progressBar = null ,

        this._init(isLocal, senderId, receiverLabel);
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
    var anchor = $('<a></a>', {download: filename, 'href': objectUrl}).html("Click here to save your file again");
    $("#completeContainer").append(anchor);
    //jquery anchor.click() won't work -> need to use the DOM method
    anchor[0].click();

    this.socket.emit('rcv_transfer_complete');
    this.socket.close(true);
};


ReceiverHandler.prototype.startDownload = function (url, filename, filesize) {
    console.log("start download");
    var that = this;
    this.filename = filename;
    this.filesize = filesize;
    $('#filename').html(filename + " (" + Math.round(filesize / 1024 / 1024) + " Mo)");
    if (this.isIeLessThan10) {
        //"old way" : Tentative avec jquery.fileDownload
        $.fileDownload(url).fail(function () {
            displayError("Error while downloading file " + filename);
        })
    } else {
        //on utilise blob, ce qui permettra en plus de faire de la ressoumission
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = function (e) {
            if (this.status == 200) {
                that.downloadComplete(this.response);
            } else {
                displayError("Error: Invalid status code" + this.status);
            }
        };
        xhr.onerror = function (e) {
            console.log("Error fetching " + url + " retrying ");
            that.retryDownload();
        };

        //TODO add xhr on progress, store current response in an array, call  that.displayProgress(progress);

        xhr.send();
    }
};


ReceiverHandler.prototype.retryDownload = function () {
    var that = this;
    if (this.nbRetries < 5) {
        this.nbRetries++;
        console.log("apparently connection lost for " + this.nbRetries + "... retrying " + " in " + (that.retryTimeout / 1000) + "s");
        displayError("Error while downloading. Restarting in a few moments", that.retryTimeout);
        setTimeout(function () {
            console.log("retarting download");
            that.displayProgress(0);
            that.socket.emit("rcv_restart_download");
        }, that.retryTimeout);
    } else {
        this.socket.emit("rcv_cancel_too_many_retries");
        this.socket.close(true);
    }
};

ReceiverHandler.prototype._init = function (isLocal, senderId, receiverLabel) {
    $('#warning-window').show();
    jdNotif.checkNotifPermissions();
    var that = this;

    var socketParams = {query: 'senderID=' + senderId + '&role=receiver&receiverLabel=' + receiverLabel};

    if (!isLocal)//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    this.socket = io(socketParams);
    this.socket.on('connect', function () {
        console.log(this.id + " - " + this.io.engine.transport.name);
    });


    this.socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });


    this.socket.on('server_stream_ready', function (url, filename, filesize) {
        that.startDownload(url, filename, filesize);
    });


    this.socket.on('sender_left', function () {
        jdNotif.notify("Oh no!", "Apparently your friend left before the transfer was complete");
        $("#errorMessage").html("Sender left before the end of transfer");
        $('#errorContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        that.socket.close(true);
    });

};
