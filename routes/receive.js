var express = require('express');
var debug = require('debug')('app:receive');
var router = express.Router();


var currentFiles = {};

var receivePrefix = '/';
var downloadPrefix ='/data/';

router.get(receivePrefix+':id', function(req, res, next){
    var fileId = req.params.id;
    debug('receive - %s', fileId);
    if(typeof currentFiles[fileId] === "undefined"){
        debug('receive - file not found');
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }else
        res.render('receive', {isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined"});
});


router.get(downloadPrefix+':id', function(req, res, next){
    var fileId = req.params.id;
    debug('download - %s', fileId);
    var streamInformations =  currentFiles[fileId];
    if(typeof streamInformations === "undefined" || streamInformations == null){
        debug('download - file not found or not prepared');
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }else{
        debug('download - serving file');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', streamInformations.size);
        res.setHeader('Content-Disposition', 'attachment; filename="' + streamInformations.name + '"');
        res.setHeader('Set-Cookie', 'fileDownload=true; path=/');
        streamInformations.stream.pipe(res);
    }
});


router.prepareStream = function(fileId){
    debug('prepareStream - %s', fileId);
    currentFiles[fileId] = null;
    return receivePrefix+fileId;
}

router.setStreamInformation = function(fileId, filename, size, stream){
    debug('setStreamInformation - %s', fileId);
    currentFiles[fileId] = {name : filename, size : size, stream : stream};
    return downloadPrefix+fileId;
}

router.streamCompleted = function(fileId){
    debug('streamCompleted - %s', fileId);
    delete currentFiles[fileId];
}



module.exports = router;