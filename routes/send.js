var express = require('express');
var path = require('path');
var debug = require('debug')('app:routes:send');
var router = express.Router();


debug.log = console.log.bind(console);

/* GET home page. */
router.get('/', function(req, res) {
    debug('serving send');
    res.render('send', {title : "Just drop it", isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined"});
});

/* GET home page. */
router.get('/no_ie', function(req, res) {
    debug('serving no ie');
    res.render('no_ie', {title : "You should be ashamed"});
});


module.exports = router;
