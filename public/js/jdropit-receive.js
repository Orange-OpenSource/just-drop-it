"use strict";
function receiveFile(isLocal, senderId) {
    $('#warning-window').show();
    var socket;
    var socketParams = { query: 'senderID=' + senderId + '&role=receiver' };
    if (!isLocal) {//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    }
    socket = io(socketParams);
    socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });



    socket.on('stream_ready', function (url, filename, filesize) {
        $('.filename').html(filename + " (" + Math.round(filesize / 1024 / 1024) + " Mo)");
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
        downloadError("Sender left before the end of transfer");
    });

    function downloadComplete(){
        $('#completeContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    }


    function downloadError(message){
        $("#errorMessage").html(message);
        $('#errorContainer').show(500);
        $('#transferContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    }
}
