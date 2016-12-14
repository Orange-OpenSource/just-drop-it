/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This file is part of just-drop-it.
 *
 * just-drop-it is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with just-drop-it.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

var debug = require('debug')('justdropit:send'),
    io = require('socket.io-client');

debug.log = console.log.bind(console);

function SenderHandler(isLocal) {
    this.init(isLocal);
}

SenderHandler.prototype = {

    constructor: SenderHandler,

    init: function (isLocal) {
        this.readWriteOpts = {highWaterMark: Math.pow(2, 19)};// 2 pow 10 = 1024
        this.receiverInfos = {};
        var that = this;

        var socketParams = {};

        if (!isLocal)//restriction on OPENSHIFT
            socketParams.path = "/_ws/socket.io/";
        this.socket = io('/send', socketParams);


        this.socket.on('connect', function () {
            debug("connect - %s - %s", this.id, this.io.engine.transport.name);

            function handleError(errorMessage) {
                appendError(errorMessage);
                $.each(that.receiverInfos, function (receiverId, receiverInfo) {
                    if (receiverInfo.active) {
                        debug("Receiver id %s failed", receiverId);
                        that.transfertEnded(receiverId, true, "your friend did not received the file");
                    } else {
                        debug("Receiver id %s not active", receiverId);
                    }
                });
            }

            that.socket.on('error', function (errorMsg) {
                debug("socket - error - %s", errorMsg);
                handleError("Error: " + errorMsg);
            });

            that.socket.on('disconnect', function () {
                debug("socket - disconnect");
                handleError("Error: you have been disconnected");
            });

        });

        this.socket.on('server_rcv_url_generated', function (url) {
            debug("url generated - %s", url);
            that.receiverUrl = window.location.host + url;
            $('#generatedurl').html("http://" + that.receiverUrl);
            $('#generatedurlreminder').html("http://" + that.receiverUrl);

        });


        this.socket.on('server_receiver_ready', function (receiverId) {
            that.receiverIsReady(receiverId);
        });


        this.socket.on('server_receiver_left', function (receiverId) {
            that.transfertEnded(receiverId, true, "Apparently your friend left before the transfer was over")

        });

        this.socket.on('server_sent_percent', function (receiverId, percent) {
            that.displayProgress(receiverId, percent);
        });

        this.socket.on('server_transfer_complete', function (receiverId) {
            that.transfertEnded(receiverId, false, "your friend correctly received your file");
        });


        this.socket.on('server_transfer_timeout', function (receiverId) {
            that.transfertEnded(receiverId, true, "your friend failed to download");
        });

        this.socket.on('server_transfer_disconnected', function (receiverId) {
            that.transfertEnded(receiverId, true, "your friend failed to download");
        });
    },

    setNavigationStep: function(step) {
        $(".o-stepbar > ol > li").each(function (idx) {
            if(step > idx) {
                $(this).removeClass("current");
                $(this).addClass("done");
            }
            else if(step == idx){
                $(this).addClass("current");
            }
        });
    },

    fileIsReady: function (fileToTransfert) {
        var sizeDisplay = fileToTransfert.size > (1024 * 1024) ? Math.round(fileToTransfert.size / 1024 / 1024) + " Mo" :
            fileToTransfert.size > 1024 ? Math.round(fileToTransfert.size / 1024) + " Ko" : fileToTransfert.size + " o";
        $('#filename').html(fileToTransfert.name + " ( " + sizeDisplay + " )");

        this.fileToTransfer = fileToTransfert;


        this.socket.emit('snd_file_ready', {
            size: fileToTransfert.size,
            name: fileToTransfert.name
        });
        $('#copyLinkContainer').show(500);
        $('#warning-window').show(500);
        $('#selectFileContainer').hide(500);
        this.setNavigationStep(1);
    },

    receiverIsReady: function(receiverId) {
        $('#copyLinkContainer').hide();
        this.setNavigationStep(2);
        $('#transfertMessage').html("Transfer in progress...");

        //init container
        var transferContainer = $('#transferContainer');
        transferContainer.show();

        var rowReceiverTemplate = $("#rowReceiverTemplate");
        var newRow = rowReceiverTemplate.clone();
        newRow.removeAttr("id");
        newRow.show();
        var linkRemove = newRow.find(".icon-delete");
        linkRemove.on("click", function (e) {
            e.preventDefault();
            newRow.hide();
        });
        linkRemove.tooltip();

        var pbContainer = newRow.children(".col-xs-8");
        var transferProgressBar = pbContainer.find("progress");
        var displayProgressBar = pbContainer.find(".text-xs-center");
        displayProgressBar.attr("id", "progress-"+receiverId);
        transferProgressBar.attr("aria-describedby", "progress-"+receiverId);
        transferContainer.append(newRow);
        this.receiverInfos[receiverId] = new ReceiverInfo(pbContainer, transferProgressBar, displayProgressBar, linkRemove);

        this.startUpload(receiverId);
    },

    startUpload: function (receiverId) {
        debug("startUpload - %s", receiverId);
        var receiverInfo = this.receiverInfos[receiverId];


        $('#transfertMessage').html("Transfert in progress...");
        var stream = ss.createStream(this.readWriteOpts);

        // upload a file to the server.
        ss(this.socket).emit('snd_send_file', stream, receiverId);

        var blobStream = ss.createBlobReadStream(this.fileToTransfer, this.readWriteOpts);

        receiverInfo.activate(stream);

        blobStream.pipe(stream);

    },

    displayProgress: function (receiverId, percent) {
        debug("displayProgress - %s - %d", receiverId, percent);
        var receiver = this.receiverInfos[receiverId];
        //update progress bar
        receiver.progressBar.attr('value', percent);
        receiver.progressBar.attr('aria-valuenow', percent);
        receiver.displayProgressBar.html(percent + '%');
    },

    transfertEnded: function (receiverId, isError, notif) {
        var receiverInfo = this.receiverInfos[receiverId];
        receiverInfo.deactivate(isError);
        var progressBarContainer = receiverInfo.progressBarContainer;
        var spanResultProperties = {};
        spanResultProperties["data-toggle"] = "tooltip";
        spanResultProperties["data-placement"] = "right";
        spanResultProperties["title"] = isError? "Transfer failed" : "Transfer successful";
        var spanResult = $("<span>", spanResultProperties)
            .addClass(isError? "icon-Thumb-down" : "icon-Thumb-up")
            .addClass("big-icon");
        progressBarContainer.empty();
        progressBarContainer.append($("<p>")
            .addClass(isError ? "text-danger" : "text-success")
            .append(spanResult)
        );
        spanResult.tooltip();
        receiverInfo.removeLinkContainer.show();

        jdNotif.notify("Transfer ended", notif);

    }
};


function sendFile(isLocal) {

    var senderHandler = new SenderHandler(isLocal);

    $("#clipboardcopyok").hide();
    //____ Handling of copy to clipboard with zeroClipboard
    var clip = new ZeroClipboard(document.getElementById("copy-button"));
    clip.on("ready", function () {
        clip.on("copy", function (event) {
            var clipboard = event.clipboardData;
            clipboard.setData("text/plain", 'http://' + senderHandler.receiverUrl);
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

    //soumission du fichier via formulaire
    $('#file').change(function (e) {
        senderHandler.fileIsReady(e.target.files[0]);
    });

    //soumission du fichier via drag and drop
    dropZone.on('drop', function (e) {
        if (e.originalEvent.dataTransfer) {
            if (e.originalEvent.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
                this.className = 'upload-drop-zone';
                senderHandler.fileIsReady(e.originalEvent.dataTransfer.files[0]);
            }
        }
    });


    $('#generatedurl').click(function () {
        $('#generatedurl').select();
    });

    $('#generatedurlreminder').click(function () {
        $('#generatedurlreminder').select();
    });

}


/******************************************************************/
function ReceiverInfo(progressBarContainer, progressBar, displayProgressBar, removeLinkContainer) {
    this.init(progressBarContainer, progressBar, displayProgressBar, removeLinkContainer);
};

ReceiverInfo.prototype = {
    constructor: ReceiverInfo,
    init: function (progressBarContainer, progressBar, displayProgressBar, removeLinkContainer) {
        this.active = false;
        this.stream = null;
        this.progressBar = progressBar;
        this.displayProgressBar = displayProgressBar;
        this.progressBarContainer = progressBarContainer;
        this.removeLinkContainer = removeLinkContainer;
    },
    activate: function (stream) {
        this.stream = stream;
        this.active = true;
    },
    deactivate: function (closeStream) {
        if (this.stream != null && closeStream) {
            debug("deactivate - closing stream");
            this.stream.destroy();
        }
        this.stream = null;
        this.active = false;
    }
};
