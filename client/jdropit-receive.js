"use strict";

var receiverHandler = (function(){
    //check if old IE version, for blob compatibility
    var div = document.createElement("div");
    div.innerHTML = "<!--[if lt IE 10]><i></i><![endif]-->";
    return {
        retryTimeout : 10000,
        filename : null,
        filesize : 0,
        nbRetries : 0,
        socket : null,
        isIeLessThan10 : (div.getElementsByTagName("i").length == 1)
    };
})();


receiverHandler.displayProgress = function(progress){
    var transferProgressBar = $('#transferProgressBar');
    transferProgressBar.attr('aria-valuenow', progress);
    transferProgressBar.width(progress + '%');
    transferProgressBar.html(progress + '%');
};

receiverHandler.downloadComplete = function(){
    jdNotif.notify("Download complete",this.filename+" was transferred correctly");
    $('#completeContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);
    this.socket.close(true);
};



receiverHandler.startDownload = function(url, filename, filesize) {
    console.log("start download");
    var that = this;
    this.filename = filename;
    this.filesize = filesize;
    $('#filename').html(filename + " (" + Math.round(filesize / 1024 / 1024) + " Mo)");
    //window.open(url, '_blank');
    //meilleur car par d'erreur popup, mais fail sous chrome (les updates ne sont par re!us)
    //window.location.href = url;
    //window.location.assign(url);
    //non testé, au cas ou : setTimeout(function(){document.location.href = "page.html;"},500);
    /** autre popup :         var popup = window.open(url);
     -         popup.blur();
     -         window.focus();   */
    if(this.isIeLessThan10){
        //"old way" : Tentative avec jquery.fileDownload
        $.fileDownload(url).fail(function(){
            displayError("Error while downloading file "+filename);
        })
    }else{
        //on utilise blob, ce qui permettra en plus de faire de la ressoumission
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = function(e) {
            if (this.status == 200) {
                if(this.response.size == that.filesize){
                    var objectUrl = window.URL.createObjectURL(this.response);
                    var anchor = $('<a></a>',{download : filename, 'href': objectUrl}).html("Click here to save your file again");
                    $("#completeContainer").append(anchor);
                    //jquery anchor.click() won't work -> need to use the DOM method
                    anchor[0].click();
                }else{
                    console.log("size differs: received ("+this.response.size +") != expected("+that.filesize+")");
                    that.retryDownload();
                }
            }else{
                displayError("Error: Invalid status code" + this.status);
            }
        };
        xhr.onerror= function(e) {
            console.log("Error fetching " + url+ " retrying ");
            that.retryDownload();
        };

        xhr.send();
    }
};


receiverHandler.retryDownload = function() {
    var that = this;
    if (this.nbRetries < 5){
        this.nbRetries++;
        console.log("apparently connection lost for "+this.nbRetries+"... retrying "+" in "+(that.retryTimeout/1000)+"s");
        displayError("Error while downloading. Restarting in few moment", that.retryTimeout);
        setTimeout(function(){
            console.log("retarting download");
            that.displayProgress(0);
            that.socket.emit("restart_download");
        }, that.retryTimeout);
    }else{
        this.socket.emit("cancel_too_many_retries");
        this.socket.close(true);
    }
};

receiverHandler.init = function(isLocal, senderId,receiverLabel) {
    $('#warning-window').show();
    jdNotif.checkNotifPermissions();
    var that = this;

    var socketParams = { query: 'senderID=' + senderId + '&role=receiver&receiverLabel=' + receiverLabel };

    if (!isLocal)//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    this.socket = io(socketParams);
    this.socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });


    this.socket.on('stream_ready', function (url, filename, filesize) {
        that.startDownload(url,filename,filesize);
    });


    this.socket.on('transfer_in_progress', function (progress) {
        //console.log('progress file ' + progress);
        //update progress bar
        that.displayProgress(progress);
        if(progress == 100){
            that.socket.emit('transfer_complete');
            that.downloadComplete();
        }

    });

    this.socket.on('sender_left', function(){
        jdNotif.notify("Oh no!","Apparently your friend left before the transfer was complete");
        $("#errorMessage").html("Sender left before the end of transfer");
        $('#errorContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        that.socket.close(true);
    });

};
