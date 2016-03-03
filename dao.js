var events = require('events');

var debug = require('debug')('app:dao');
var error = require('debug')('app:dao');
debug.log = console.log.bind(console);

function Receiver(sender, receiverId, socket) {
    debug('Receiver - init - %s', receiverId);
    this.sender = sender;
    this.receiverId = receiverId;
    this.socket = socket;
    events.EventEmitter.call(this);
}

Receiver.super_ = events.EventEmitter;

Receiver.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: Receiver
});

Receiver.prototype.notifySent = function (percent) {
    debug("notifySent - %d", percent);
    this.emit('sent', percent);
};


Receiver.prototype.notifyTimeout = function () {
    this.emit('timeout');
};

Receiver.prototype.notifyFinished = function () {
    this.emit('finish');
};

Receiver.prototype.watchSent = function (fun) {
    this.on('sent', fun);
};

Receiver.prototype.watchFinished = function (fun) {
    this.on('finish', fun);
};

Receiver.prototype.watchTimeout = function (fun) {
    this.on('timeout', fun);
};


Receiver.prototype._clean = function () {
    debug('Receiver - clean - %s', this.receiverId);
    //clean event receivers
    var that = this;

    function cleanEvent(eventName) {
        debug('Receiver - %s - clean event - %s', that.receiverId, eventName);
        while (typeof that._events[eventName] != "undefined") {
            if (typeof that._events[eventName] == "function") {
                that.removeListener(eventName, that._events[eventName]);
            }
            else {//occurs when two "on" call on same event
                that.removeListener(eventName, that._events[eventName][0])
            }
        }
    }

    cleanEvent('sent');
    cleanEvent('finish');

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