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
var debug = require('debug')('justdropit:receive'),
    io = require('socket.io-client');

debug.log = console.log.bind(console);

function ReceiverHandler(isLocal, senderId, fileName, fileSize) {
    this.filename = fileName,
        this.filesize = fileSize,
        this.socket = null,
        this.progressBar = $(".progress-bar"),
        this.totalTries = 0,
        this._init(isLocal, senderId);
    //TODO debug filename
    debug("filename = %s", fileName);
    debug("filesize = %d", fileSize);
}

ReceiverHandler.prototype.displayProgress = function (percent) {
    debug("displayProgress=%d", percent);
    this.progressBar.attr('aria-valuenow', percent);
    this.progressBar.width(percent + '%')
    this.progressBar.html(percent + '%');
};

ReceiverHandler.prototype.downloadComplete = function () {
    debug("downloadComplete");
    jdNotif.notify("Download complete", this.filename + " was transferred correctly");

    $('#completeContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);

    this.socket.close(true);
};


ReceiverHandler.prototype.downloadError = function (notif, message) {
    debug("downloadError");
    debug(notif);
    jdNotif.notify("Oh no!", notif);
    $("#errorMessage").html(message);
    $('#errorContainer').show(500);
    $('#transferContainer').hide(500);
    $("#warning-window").hide(500);
    this.socket.close(true);

}

ReceiverHandler.prototype.startDownload = function (url) {
    debug("start download - %s", url);
    this.totalTries++;
    var that = this;
    $('#filename').html(this.filename + " (" + Math.round(this.filesize / 1024 / 1024) + " Mo)");
    $.fileDownload(url).fail(function (error) {
        debug("error during file download");
        debug(error)
        appendError("Error while downloading file " + that.filename);
    })
};


ReceiverHandler.prototype._init = function (isLocal, senderId) {
    $('#warning-window').show();
    const that = this;

    const socketParams = {path : "/_ws/socket.io/"};

    this.socket = io('/receive', socketParams);
    this.socket.on('connect', function () {
        debug("connect - %s - %s", this.id, this.io.engine.transport.name);
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
        // fix #48.
        that.downloadComplete();
    });
    this.socket.on('server_transfer_timeout', function () {
        that.downloadError("Download failed", "You did not download the file");
    });
    this.socket.on('server_transfer_disconnected', function () {
        that.downloadComplete();
    });
};
