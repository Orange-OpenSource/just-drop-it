/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This program is free software; you can redistribute it and/or
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
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";
function ReceiverHandler(isLocal, senderId, fileName, fileSize) {
    this.filename = fileName,
        this.filesize = fileSize,
        this.socket = null,
        this.progressBar = $("#transferProgressBar"),
        this.totalTries = 0,
        this._init(isLocal, senderId);
    //TODO debug filename
    console.log("filename = " + filename);
    console.log("filesize = " + fileSize);
}

ReceiverHandler.prototype.displayProgress = function (percent) {
    console.log("displayProgress=" + percent);
    this.progressBar.attr('aria-valuenow', percent);
    this.progressBar.width(percent + '%');
    this.progressBar.html(percent + '%');
};

ReceiverHandler.prototype.downloadComplete = function () {
    jdNotif.notify("Download complete", this.filename + " was transferred correctly");

    $('#completeContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);

    this.socket.close(true);
};


ReceiverHandler.prototype.downloadError = function (notif, message) {
    jdNotif.notify("Oh no!", notif);
    $("#errorMessage").html(message);
    $('#errorContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);
    this.socket.close(true);

}

ReceiverHandler.prototype.startDownload = function (url) {
    console.log("start download");
    this.totalTries++;
    var that = this;
    $('#filename').html(this.filename + " (" + Math.round(this.filesize / 1024 / 1024) + " Mo)");
    $.fileDownload(url).fail(function () {
        appendError("Error while downloading file " + that.filename);
    });
};


ReceiverHandler.prototype._init = function (isLocal, senderId) {
    $('#warning-window').show();
    jdNotif.checkNotifPermissions();
    var that = this;

    //NEVER USER POLLING ONLY, IT FAILS: var socketParams = {query: 'senderID=' + senderId + '&role=receiver', transports: ['polling']};
    var socketParams = {transports: ['websocket']};

    if (!isLocal)//restriction on OPENSHIFT
        socketParams.path = "/_ws/socket.io/";
    this.socket = io('/receive', socketParams);
    this.socket.on('connect', function () {
        console.log(this.id + " - " + this.io.engine.transport.name);
        that.socket.on('error', function (errorMsg) {
            appendError("Error: " + errorMsg);
        });
        that.socket.emit('rcv_sender', senderId);
    });


    this.socket.on('server_stream_ready', function (url) {
        that.startDownload(url);
    });


    this.socket.on('server_sender_left', function () {
        that.downloadError("Apparently your friend left before the transfer was complete", "Sender left before the end of transfer");
    });

    this.socket.on('server_sent_percent', function (percent) {
        that.displayProgress(percent);
    });

    this.socket.on('server_transfer_complete', function () {
        that.downloadComplete();
    });
    this.socket.on('server_transfer_timeout', function () {
        that.downloadError("Download failed", "You did not download the file");
    });
};
