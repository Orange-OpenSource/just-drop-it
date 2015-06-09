var express = require('express');
var debug = require('debug')('app:routes:receive');
var router = express.Router();
var error = require('debug')('app:routes:receive');

var currentFiles = {};

var receivePrefix = '/';
var downloadPrefix ='/data/';

debug.log = console.log.bind(console);

router.get(receivePrefix+':id', function(req, res, next){
    var fileId = req.params.id;
    if(typeof currentFiles[fileId] === "undefined"){
        error('receive - file not found %s', fileId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }else{
        debug('receive - rendering receive for file %s', fileId);
        res.render('receive', {title : "Just drop it" , isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined", senderId : fileId});
    }

});


router.get(downloadPrefix+':id', function(req, res, next){
    var fileId = req.params.id;
    var streamInformations =  currentFiles[fileId];
    if(typeof streamInformations === "undefined" || streamInformations == null){
        error('download - file not found or not prepared: %s', fileId);
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }else{
        debug('download - serving file %s', fileId);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', streamInformations.size);
        res.setHeader('Content-Disposition', 'attachment; filename="' + streamInformations.name + '"');
        res.setHeader('Set-Cookie', 'fileDownload=true; path=/');
        streamInformations.stream.pipe(res);
        streamInformations.response = res;
    }
});


router.prepareStream = function(fileId){
    debug('prepareStream - %s', fileId);
    currentFiles[fileId] = null;
    return receivePrefix+fileId;
}

router.setStreamInformation = function(fileId, filename, size, stream){
    debug('setStreamInformation - %s', fileId);
    currentFiles[fileId] = {name : filename, size : size, stream : stream, response : null};
    return downloadPrefix+fileId;
}

router.streamCompleted = function(fileId, forceClosure){
    debug('streamCompleted - %s', fileId);
    if(forceClosure){
        var currentFile = currentFiles[fileId];
        if(typeof currentFile != "undefined" && currentFile.response != null) {
            debug('streamCompleted - forcing stream closure');
            currentFile.stream.unpipe(currentFile.response);
            currentFile.response.connection.destroy();
        }
    }
    delete currentFiles[fileId];
}



module.exports = router;