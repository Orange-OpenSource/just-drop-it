var express = require('express');
var debug = require('debug')('app:routes:receive');
var router = express.Router();
var error = require('debug')('app:routes:receive');

var currentFiles = {};

var receivePrefix = '/';
var downloadPrefix = '/data/';

debug.log = console.log.bind(console);

FileInfo = function (name, size) {
    this.init(name, size);
};
FileInfo.prototype = {
    constructor: FileInfo,
    init: function (name, size) {
        this.name = name;
        this.size = size;
        this.receivers = [];
    },
    addReceiver: function (receiverId, stream) {
        this.receivers[receiverId] = {stream: stream, response: null};
    },

    removeReceiver: function (receiverId) {
        if (typeof this.receivers[receiverId] != "undefined") {
            delete this.receivers[receiverId];
            return true;
        } else {
            return false;
        }
    }
};
router.get(receivePrefix + ':id', function (req, res, next) {
    var fileId = req.params.id;
    var fileInfo = currentFiles[fileId];
    if (typeof fileInfo === "undefined") {
        error('receive - file not found %s', fileId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    } else {
        debug('receive - rendering receive for file %s', fileId);
        res.render('receive', {
            title: "Just drop it",
            isLocal: typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
            fileName: fileInfo.name,
            fileSize: fileInfo.size,
            jdropitVersion: global.DROP_IT_VERSION,
            receiverLabel: req.cookies['CTI']
        });
    }

});


router.get(downloadPrefix + ':id/:receiverId', function (req, res, next) {
    var fileId = req.params.id;
    var receiverId = req.params.receiverId;
    var streamInformations = currentFiles[fileId];
    if (typeof streamInformations === "undefined" || typeof streamInformations.receivers[receiverId] == "undefined") {
        error('download - file not found or not prepared: %s/%s', fileId, receiverId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    } else {
        debug('download - serving file %s', fileId);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', streamInformations.size);
        res.setHeader('Content-Disposition', 'attachment; filename="' + streamInformations.name + '"');
        res.setHeader('Set-Cookie', 'fileDownload=true; path=/');
        streamInformations.receivers[receiverId].stream.pipe(res);
        streamInformations.receivers[receiverId].response = res;
    }
});


router.prepareStream = function (fileId, filename, size) {
    debug('prepareStream - %s', fileId);
    currentFiles[fileId] = new FileInfo(filename, size);
    return receivePrefix + fileId;
};


function buildReceiverRoute(fileId, receiverId) {
    return downloadPrefix + fileId + "/" + receiverId;
}

router.addReceiver = function (fileId, receiverId, stream) {
    var fileInfo = currentFiles[fileId];
    fileInfo.addReceiver(receiverId, stream);
    var routeAdded = buildReceiverRoute(fileId, receiverId);
    debug("addReceiver - %s added", routeAdded);
    return {route: routeAdded, filename: fileInfo.name, size: fileInfo.size};

};


router.removeReceiver = function (fileId, receiverId) {
    debug('removeReceiver - %s', fileId);
    var fileInformations = currentFiles[fileId];
    if (typeof fileInformations != "undefined") {
        fileInformations.allReceiverStream(receiverId, function (packetIndex, streamInfo) {
            var routeRemoved = buildReceiverPacketRoute(fileId, receiverId, packetIndex);
            debug("removeReceiver - %s removed", routeRemoved);
        });
        return fileInformations.removeReceiver(receiverId);
    } else
        return false;
};

router.removeStream = function (fileId) {
    var fileInformations = currentFiles[fileId];
    if (typeof fileInformations != "undefined") {
        fileInformations.allStream(function (receiverId, packetIndex, streamInfo) {
            if (streamInfo.response != null) {
                streamInfo.stream.unpipe(streamInfo.response);
                streamInfo.response.connection.destroy();
            }

        });
        debug('removeStream - %s removed', fileId);
        delete currentFiles[fileId];
    }
};

module.exports = router;