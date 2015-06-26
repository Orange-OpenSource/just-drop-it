var express = require('express');
var debug = require('debug')('app:routes:receive');
var router = express.Router();
var error = require('debug')('app:routes:receive');

var currentFiles = {};

var receivePrefix = '/';
var downloadPrefix = '/data/';

debug.log = console.log.bind(console);

router.get(receivePrefix + ':id', function (req, res, next) {
    var fileId = req.params.id;
    if (typeof currentFiles[fileId] === "undefined") {
        error('receive - file not found %s', fileId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    } else {
        debug('receive - rendering receive for file %s', fileId);
        res.render('receive', {
            title: "Just drop it",
            isLocal: typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
            senderId: fileId,
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
    currentFiles[fileId] = {name: filename, size: size, receivers: {}};
    return receivePrefix + fileId;
};


function buildReceiverRoute(fileId, receiverId){
    return downloadPrefix + fileId + "/" + receiverId;
}

router.addReceiver = function (fileId, receiverId, stream) {
    var currentFile = currentFiles[fileId];
    currentFile.receivers[receiverId] = {stream: stream, response: null};
    var routeAdded = buildReceiverRoute(fileId, receiverId);
    debug("addReceiver - %s added", routeAdded);
    return {route : routeAdded, filename : currentFile.name, size: currentFile.size};

};


router.removeReceiver = function (fileId, receiverId) {
    debug('streamCompleted - %s', fileId);
    var currentFile = currentFiles[fileId];
    if (typeof currentFile != "undefined" && typeof currentFile.receivers[receiverId] != "undefined") {
        delete currentFile.receivers[receiverId];
        var routeRemoved = buildReceiverRoute(fileId, receiverId);
        debug("removeReceiver - %s removed", routeRemoved);
        return true;
    }else
        return false;
};

router.removeStream = function (fileId) {
    var currentFile = currentFiles[fileId];
    if (typeof currentFile != "undefined") {
        for (var receiverId in currentFile.receivers) {
            if (currentFile.receivers.hasOwnProperty(receiverId)) {
                currentFile.receivers[receiverId].stream.unpipe(currentFile.response);
                currentFile.receivers[receiverId].response.connection.destroy();
            }
        }
        debug('removeStream - %s removed', fileId);
        delete currentFiles[fileId];
    }
}

module.exports = router;