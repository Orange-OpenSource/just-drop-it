"use strict";
function receiveFile(isLocal, senderId,receiverLabel) {
    $('#warning-window').show();
    var socket;
    var socketParams = { query: 'senderID=' + senderId + '&role=receiver&receiverLabel=' + receiverLabel };
    if (!isLocal)//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    socket = io(socketParams);
    socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });

    var localFileName;


    socket.on('stream_ready', function (url, filename, filesize) {
        localFileName = filename;
        $('#filename').html(filename + " (" + Math.round(filesize / 1024 / 1024) + " Mo)");
        //window.open(url, '_blank');
        //meilleur car par d'erreur popup, mais fail sous chrome (les updates ne sont par re!us)
        //window.location.href = url;
        //window.location.assign(url);
        //non testé, au cas ou : setTimeout(function(){document.location.href = "page.html;"},500);
        /** autre popup :         var popup = window.open(url);
         -         popup.blur();
         -         window.focus();   */
        //Tentative avec jquery.fileDownload
        $.fileDownload(url).fail(function(){
            displayError("Error while downloading file "+filename);
        })
    });

    socket.on('transfer_in_progress', function (progress) {
        //console.log('progress file ' + progress);
        //update progress bar
        var transferProgressBar = $('#transferProgressBar');
        transferProgressBar.attr('aria-valuenow', progress);
        transferProgressBar.width(progress + '%');
        transferProgressBar.html(progress + '%');
        if(progress == 100){
            socket.emit('transfer_complete');
            downloadComplete();
        }

    });

    socket.on('sender_left', function(){
        jdNotif.notify("Oh no!","Apparently your friend left before the transfer was complete");
        $("#errorMessage").html("Sender left before the end of transfer");
        $('#errorContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    });

    function downloadComplete(){
        jdNotif.notify("Download complete",localFileName+" was transferred correctly");
        $('#completeContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    }

}
