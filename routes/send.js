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


module.exports = router;
