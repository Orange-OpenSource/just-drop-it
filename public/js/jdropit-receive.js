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
        var transfertPb = $('#transfertpb');
        transfertPb.attr('aria-valuenow', progress);
        transfertPb.width(progress + '%');
        transfertPb.html(progress + '%');
        if(progress == 100){
            socket.emit('transfer_complete');
            downloadComplete();
        }

    });

    socket.on('sender_left', function(){
        socket.close(true);
        downloadError("Sender left before the end of transfer");
    });

    function downloadComplete(){
        $('#step4-outro').show(500);
        $('#transfertdiv').hide(500);
        $("#warning-window").hide(500);
    }


    function downloadError(message){
        $("#error_message").html(message);
        $('#step4-error').show(500);
        $('#transfertdiv').hide(500);
        $("#warning-window").hide(500);
    }
}
