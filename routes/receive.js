var express = require('express');
var debug = require('debug')('app:routes:receive');
var router = express.Router();
var error = require('debug')('app:routes:receive');

var dao = require("../dao");


router.servePagePath = '/';
router.downloadPath = '/data/';

debug.log = console.log.bind(console);


router.get(router.servePagePath + ':id', function (req, res, next) {
    var fileId = req.params.id;
    dao.getSender(fileId, function (sender) {
        debug('receive - rendering receive for file %s', fileId);
        res.render('receive', {
            title: "Just drop it",
            isLocal: typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
            fileName: sender.fileName,
            fileSize: sender.fileSize,
            jdropitVersion: global.DROP_IT_VERSION,
            senderId: fileId,
            receiverLabel: req.cookies['CTI']
        });
    }, function () {
        error('receive - file not found %s', fileId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
});


router.get(router.downloadPath + ':id/:receiverId', function (req, res, next) {
    var fileId = req.params.id;
    var receiverId = req.params.receiverId;

    function getNumberOfBytesSent() {
        //req.socket or res.connection
        var socket = req.socket;
        debug("getNumberOfBytesSent - %d - %d", socket.bufferSize, socket.bytesWritten);
        return socket.bytesWritten + socket.bufferSize;
    }

    function encodeFileName(fileName) {
        var result = [];
        for (var cpt = 0; cpt < fileName.length; cpt++) {
            var currentChar = fileName[cpt];
            if ((currentChar >= 'a' && currentChar <= 'z') || (currentChar >= 'A' && currentChar <= 'Z') || (currentChar >= '0' && currentChar <= '9')
                || currentChar == '.' || currentChar == '_' || currentChar == '(' || currentChar == ')' || currentChar == '[' || currentChar == ']' || currentChar == ' ') {
                result.push(currentChar);
            }
        }
        return result.join('');
    }


    dao.getReceiver(fileId, receiverId, function (receiver) {
        debug('download - serving file %s', fileId);
        var initSize = getNumberOfBytesSent();

        var HEAD_SIZE_WITHOUT_FILE_NAME = 253;
        var CHECK_SEND_DELAY_IN_MS = 500;

        //sends header to flush them
        var encodedFileName = encodeFileName(receiver.sender.fileName);

        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': receiver.sender.fileSize,
            'Content-Disposition': 'attachment; filename="' + encodedFileName + '"',
            'Set-Cookie': 'fileDownload=true; path=/'
        });


        var headSize = encodedFileName.length + HEAD_SIZE_WITHOUT_FILE_NAME;

        receiver.stream.pipe(res);
        var intervalId = setInterval(function () {
            var nbBytesSent = getNumberOfBytesSent() - headSize - initSize;
            if(nbBytesSent > 0){
                receiver.notifySent(nbBytesSent);
            }

        }, CHECK_SEND_DELAY_IN_MS);
        res.on('finish', function () {
            debug("finished");
            receiver.notifyFinished();
        });
        receiver.clean = function () {
            if (res.connection != null) {
                debug("closing active download of %s/%s", fileId, receiverId);
                receiver.stream.unpipe(res);
                res.connection.destroy();
            }
            clearInterval(intervalId);
        };
        res.connection.write('', 'utf8', function () {

        });


    }, function () {
        error('download - file not found or not prepared: %s/%s', fileId, receiverId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
});


module.exports = router;