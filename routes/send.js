var express = require('express');
var path = require('path');
var debug = require('debug')('app:routes:send');
var router = express.Router();


debug.log = console.log.bind(console);

/* GET home page. */
router.get('/', function(req, res) {
    debug('serving send');
    res.render('send', {isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined"});
});

/* GET home page. */
router.get('/noie', function(req, res) {
    debug('serving no ie');
    res.sendFile('noie.html', { root: path.join(__dirname, '../public') });
});


module.exports = router;
