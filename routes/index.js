var express = require('express');
var path = require('path');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('send', {isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined"});
});

/* GET home page. */
router.get('/noie', function(req, res, next) {
    res.sendFile('noie.html', { root: path.join(__dirname, '../public') });
});

router.registerFile = function(fileId){
    router.get("/"+fileId, function(req, res, next){
        res.render('receive', {isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined"});

    });
}


router.registerStream = function(streamId, stream, fileName, fileSize){
    router.get('/' + streamId, function (req, res) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
        stream.pipe(res);
    });
}


module.exports = router;
