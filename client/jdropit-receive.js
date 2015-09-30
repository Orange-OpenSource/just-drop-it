"use strict";
function ReceiverHandler(isLocal, senderId, receiverLabel, fileName, fileSize) {
    //TODO check if old IE version, for blob compatibility
    this.isIELessThan10 = false,
        this.filename = fileName,
        this.filesize = fileSize,
        this.socket = null,
        this.progressBar = $("#transferProgressBar"),
        this.storedResponses = [],
        this.retryPeriod = 2000,
        this.totalTries = 0,
        this._init(isLocal, senderId, receiverLabel);
    //TODO debug filename
    console.log("filename = " + filename);
    console.log("filesize = " + fileSize);
}

ReceiverHandler.prototype.displayProgress = function (progress) {
    this.progressBar.attr('aria-valuenow', progress);
    this.progressBar.width(progress + '%');
    this.progressBar.html(progress + '%');
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

    this.socket.emit('rcv_transfer_complete',this.totalTries);
    this.socket.close(true);
};


ReceiverHandler.prototype.startDownload = function (url) {
    console.log("start download");
    this.totalTries++;

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
        var lastTotal;
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
            var preloaded = that.filesize - e.total;
            var percentComplete = Math.floor(((e.loaded + preloaded) / that.filesize) * 100);
            console.log("[FileSize="+that.filesize+" previouslyLoaded= "+preloaded+"] [currentStreamSize="+ e.total+" loaded="+ e.loaded+"]");
            that.displayProgress(percentComplete);
            lastResponse = e.target.response;
            lastBytesLoaded = e.loaded;
            lastTotal = e.total; /* on chrome, onerror event.total is given, but firefox give 0 so we have to store it*/
        };
        xhr.onerror = function (e) {
            console.log("Error fetching " + url + " retrying ");
            that.storedResponses.push(lastResponse);
            that.waitUntilNetworkIsBack(lastTotal - lastBytesLoaded);
        };

        xhr.send();
    }
};

ReceiverHandler.prototype.waitUntilNetworkIsBack = function (remainingBytes) {
    console.log("Testing connectivity");
    var that = this;
    var networkIsBack = false;

    $("#errorMessage").html("You are experiencing some network issues, please check your connection");
    $('#errorContainer').show(500);

    var netTester = setInterval(function () {
        if (!networkIsBack) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', "/", true);
            xhr.onload = function (e) {
                console.log("Network is back");
                $('#errorContainer').hide(500);
                networkIsBack = true;
            };
            xhr.onerror = function (e) {
                console.log("still no network");
            };
            xhr.send();
        } else {
            console.log("Stop timer and follow");
            clearInterval(netTester);
            that._resumeDownload(remainingBytes)
        }
    }, that.retryPeriod);
};

ReceiverHandler.prototype._resumeDownload = function (remainingBytes) {
    console.log("re-asking for download for the last " + remainingBytes + " bytes.");
    this.socket.emit("rcv_resume_download", remainingBytes);

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

};
