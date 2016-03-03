var express = require('express');
var path = require('path');
var debug = require('debug')('app:routes:send');
var router = express.Router();
var fs    = require("fs");


debug.log = console.log.bind(console);

/* GET home page. */
router.get('/', function(req, res) {
    debug('serving send');
    res.render('send', {title : "Just drop it",
        isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
        jdropitVersion : global.DROP_IT_VERSION});
});

/* GET home page. */
router.get('/no_ie', function(req, res) {
    debug('serving no ie');
    res.render('no_ie', {title : "Sorry, your browser is not compatible"});
});

/* test download*/
router.get('/test_down', function(req, res) {

    var filename = path.basename("test_down.mp4");
    var stream = fs.createReadStream(filename,{
        highWaterMark: Math.pow(2,21)
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', 874795463 );
    res.setHeader('Content-Disposition', 'attachment; filename="test.mp4"');
    res.setHeader('Set-Cookie', 'fileDownload=true; path=/');
    stream.pipe(res);

});


router.get('/down_source', function(req, res){
    var file = path.basename("just-drop-it.zip");
    res.download(file);
});



module.exports = router;
