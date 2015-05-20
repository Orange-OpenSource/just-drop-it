var express = require('express');
var path = require('path');
var router = express.Router();


var currentFiles = {};

var receivePrefix = '/';
var downloadPrefix ='/data/';

router.get(receivePrefix+':id', function(req, res, next){
    var fileId = req.params.id;
    console.log('receive - '+fileId);
    if(typeof currentFiles[fileId] === "undefined"){
        console.log('receive - file not found');
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }else
        res.render('receive', {isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined"});
});


router.get(downloadPrefix+':id', function(req, res, next){
    var fileId = req.params.id;
    console.log('download - '+fileId);
    var streamInformations =  currentFiles[fileId];
    if(typeof streamInformations === "undefined" || streamInformations == null){
        console.log('download - file not found or not prepared');
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }else{
        console.log('download - serving file');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', streamInformations.size);
        res.setHeader('Content-Disposition', 'attachment; filename="' + streamInformations.name + '"');
        streamInformations.stream.pipe(res);
    }
});


router.prepareStream = function(fileId){
    console.log('prepareStream - '+fileId);
    currentFiles[fileId] = null;
    return receivePrefix+fileId;
}

router.setStreamInformation = function(fileId, filename, size, stream){
    console.log('setStreamInformation - '+fileId);
    currentFiles[fileId] = {name : filename, size : size, stream : stream};
    return downloadPrefix+fileId;
}

router.streamCompleted = function(fileId){
    console.log('streamCompleted - '+fileId);
    delete currentFiles[fileId];
}



module.exports = router;