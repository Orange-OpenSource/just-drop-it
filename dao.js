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


var debug = require('debug')('app:dao');
debug.log = console.log.bind(console);

function Receiver(sender, receiverId, socket) {
    debug('Receiver - init - %s', receiverId);
    this.sender = sender;
    this.receiverId = receiverId;
    this.socket = socket;
    this.endNotified = false;
}


Receiver.prototype.notifySent = function (percent) {
    debug("notifySent - %d", percent);
    this.sender.socket.emit('server_sent_percent', this.receiverId, percent);
    this.socket.emit('server_sent_percent', percent);
};

Receiver.prototype._end = function(endEvent){
    if(!this.endNotified){
        this.socket.emit(endEvent);
        this.sender.socket.emit(endEvent, this.receiverId);
        this.sender.removeReceiver(this.receiverId);
        debug("%s/%s %s - filename=%s - filesize=%d",  this.sender.senderId, this.receiverId, endEvent, this.sender.fileName, this.sender.fileSize);
        this.endNotified = true;
    }
};

Receiver.prototype.timeout = function () {
    this._end('server_transfer_timeout');
};

Receiver.prototype.completed = function () {
    this._end('server_transfer_complete');
};



Receiver.prototype._clean = function () {
    debug('Receiver - clean - %s', this.receiverId);
    //clean resources
    if (typeof this.clean == "function")
        this.clean();
};

//set this function to clean resources
Receiver.prototype.clean = null;


function Sender(senderId, socket) {
    debug('Sender - init - %s', senderId);
    this.senderId = senderId;
    this.socket = socket;
    this.receivers = {};
}

Sender.prototype.addReceiver = function (receiverId, socket) {
    debug('Sender - addReceiver - %s', receiverId);
    var result = new Receiver(this, receiverId, socket);
    this.receivers[receiverId] = result;
    return result;
};

Sender.prototype.eachReceiver = function (callback) {
    for (var receiverIds in this.receivers) {
        if (this.receivers.hasOwnProperty(receiverIds)) {
            callback(this.receivers[receiverIds]);
        }
    }
};

Sender.prototype.removeReceiver = function (receiverId) {
    var receiver = this.receivers[receiverId];
    if (typeof receiver != "undefined") {
        debug('Sender - removeReceiver - %s', receiverId);
        receiver._clean();
        delete  this.receivers[receiverId];
        return true;
    } else
        return false;
};

Sender.prototype.clean = function () {
    debug('Sender - clean - %s', this.senderId);
    //clean resources
    this.eachReceiver(function (receiver) {
        receiver._clean();
    });
    this.receivers = {};
};


var Dao = function () {
    this.senders = {};
};


Dao.prototype._checkDefined = function (obj, callback, undefinedCallback) {
    if (typeof obj == "undefined")
        undefinedCallback();
    else
        callback(obj);
};

Dao.prototype.createSender = function (senderId, socket, callback) {
    var result = new Sender(senderId, socket);
    this.senders[senderId] = result;
    callback(result);
};

Dao.prototype.removeSender = function (senderId, deletedCallback, notFoundCallback) {
    var self = this;
    this._checkDefined(this.senders[senderId], function (sender) {
        sender.clean();
        delete self.senders[senderId];
        deletedCallback();
    }, notFoundCallback);
};

Dao.prototype.getSender = function (senderId, callback, notFoundCallback) {
    this._checkDefined(this.senders[senderId], callback, notFoundCallback);
};

Dao.prototype.eachSenders = function (callback) {
    for (var senderId in this.senders) {
        if (this.senders.hasOwnProperty(senderId)) {
            callback(this.senders[senderId]);
        }
    }
};

Dao.prototype.addReceiver = function (senderId, receiverId, socket, callback, notFoundCallback) {
    this._checkDefined(this.senders[senderId], function (sender) {
        sender.addReceiver(receiverId, socket);
        callback(sender);
    }, notFoundCallback);
};

Dao.prototype.getReceiver = function (senderId, receiverId, callback, notFoundCallback) {
    var self = this;
    this.getSender(senderId, function (sender) {
        self._checkDefined(sender.receivers[receiverId], callback, notFoundCallback);
    }, notFoundCallback);
};


debug("dao created");


exports = module.exports = new Dao();