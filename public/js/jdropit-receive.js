"use strict";
function receiveFile(isLocal, senderId) {
    $('#warning-window').show();
    var socket;
    var socketParams = { query: 'userID=undefReceiver&senderID=' + senderId + '&role=receiver' };
    if (!isLocal) {//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    }
    socket = io(socketParams);
    socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });

    socket.on('connection_ready', function () {
        console.log('connection ready');
    });

    ss(socket).on('forward_file', function () {
        console.log('forward file');
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

    socket.on('transfert_in_progress', function (progress) {
        //console.log('progress file ' + progress);
        //update progress bar
        var transfertProgressBar = $('#transfertProgressBar');
        transfertProgressBar.attr('aria-valuenow', progress);
        transfertProgressBar.width(progress + '%');
        transfertProgressBar.html(progress + '%');
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
        $('#transfertContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    }


    function downloadError(message){
        $("#errorMessage").html(message);
        $('#errorContainer').show(500);
        $('#transfertContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    }
}
