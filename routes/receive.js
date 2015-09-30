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
    dao.getSender(fileId, function(sender){
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
    }, function(){
        error('receive - file not found %s', fileId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
});


router.get(router.downloadPath + ':id/:receiverId', function (req, res, next) {
    var fileId = req.params.id;
    var receiverId = req.params.receiverId;
    dao.getReceiver(fileId, receiverId, function(receiver){
        debug('download - serving file %s', fileId);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', receiver.remainingBytes);
        res.setHeader('Content-Disposition', 'attachment; filename="' + receiver.sender.fileName + '"');
        res.setHeader('Set-Cookie', 'fileDownload=true; path=/');
        receiver.stream.pipe(res);
        receiver.clean = function(){
            if(res.connection != null){
                debug("closing active download of %s/%s", fileId, receiverId);
                receiver.stream.unpipe(res);
                res.connection.destroy();
            }

        };
    }, function(){
        error('download - file not found or not prepared: %s/%s', fileId, receiverId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
});



module.exports = router;