function sendFile(isLocal) {



    $("#clipboardcopyok").hide();


    //____ Handling of copy to clipboard with zeroClipboard
    var clip = new ZeroClipboard(document.getElementById("copy-button"));
    clip.on("ready", function () {
        clip.on("copy", function (event) {
            var clipboard = event.clipboardData;
            clipboard.setData("text/plain", 'http://' + receiverUrl);
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


    var socket;
    var receiverUrl;

    //init du socket vers le serveur
    if (isLocal) {
        socket = io({
            query: 'userID=undefined&role=sender'
        });
    } else {
        socket = io({
            query: 'userID=undefined&role=sender',
            path: "/_ws/socket.io/"
        });
    }

    socket.on('receive_url_ready', function (url) {
        receiverUrl = window.location.host + url;
        $('#generatedurl').html("<p>http://" + receiverUrl + " </p> ");
    });

    socket.on('receiver_ready', function (receiverId) {
        $('#copyLinkContainer').hide(500);
        startUpload(fileToTransfert);
    });

    socket.on('alert', function (errorMsg) {
        displayError("Error: " + errorMsg);
    });

    socket.on('receiver_left', function(){
        socket.close(true);
        downloadError("Receiver left before the end of transfer");
    });

    socket.on('transfer_complete', uploadComplete);


    var fileToTransfert;

    //soumission du fichier via formulaire
    $('#file').change(function (e) {
        fileToTransfert = e.target.files[0];
        fileIsReady();
        //startUpload(e.target.files);
    });

    //soumission du fichier via drag and drop
    dropZone.on('drop', function (e) {
        if (e.originalEvent.dataTransfer) {
            if (e.originalEvent.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
                /*UPLOAD FILES HERE*/
                this.className = 'upload-drop-zone';
                fileToTransfert = e.originalEvent.dataTransfer.files[0];
                fileIsReady();
            }
        }
    });

    function fileIsReady() {
        $('.filename').html(fileToTransfert.name + " (" + Math.round(fileToTransfert.size / 1024 / 1024) + " Mo)");
        $('#copyLinkContainer').show(500);
        $('#transfertContainer').show(500);
        $('#warning-window').show(500);
        $('#selectFileContainer').hide(500);
    };


    //fonction d'upload du fichier
    function startUpload(file) {
        console.log(file);

        var readWriteOpts = {highWaterMark: Math.pow(2,21)};

        $('#transfertMessage').html("Transfert in progress...");
        var stream = ss.createStream(readWriteOpts);

        // upload a file to the server.
        ss(socket).emit('send_file', stream, {
            size: file.size,
            name: file.name
        });

        var blobStream = ss.createBlobReadStream(file,readWriteOpts);
        var size = 0;

        blobStream.on('data', function (chunk) {
            size += chunk.length;
            //console.log(Math.floor(size / file.size * 100) + '%');
            var progress = Math.floor(size / file.size * 100);

            socket.emit('transfert_in_progress', progress);

            //update progress bar
            var transfertPb = $('#transfertpb');
            transfertPb.attr('aria-valuenow', progress);
            transfertPb.width(progress + '%');
            transfertPb.html(progress + '%');
        });


        blobStream.pipe(stream);
    };

    function uploadComplete(receiverId){
        console.log("uploadComplete - "+receiverId);
        $('#completeContainer').show(500);
        $('#transfertContainer').hide(500);
        $('#warning-window').hide(500);
        socket.close(true);
    }

    function downloadError(message){
        $("#error_message").html(message);
        $('#errorContainer').show(500);
        $('#transfertContainer').hide(500);
        $("#warning-window").hide(500);
        socket.close(true);
    }



    $('#generatedurl').click(function () {
        $('#generatedurl').select();
    });
}
