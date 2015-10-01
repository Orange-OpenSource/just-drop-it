/**
 * Created by buce8373 on 01/10/2015.
 */
var express = require('express');
var debug = require('debug')('app:routes:admin');
var router = express.Router();
var dao    = require("../dao");


debug.log = console.log.bind(console);

/* GET home page. */
router.get('/', function(req, res) {
    debug('serving send with cookie %s',req.cookies['CTI']);
    var senders = [];
    dao.eachSenders(function(sender){
        var senderObj = {id : sender.senderId, receivers : []};
        sender.eachReceiver(function(receiver){
            senderObj.receivers.push(receiver.receiverId);
        });
        senders.push(senderObj);
    });
    res.render('admin', {title : "Just drop it Admin",
        isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
        jdropitVersion : global.DROP_IT_VERSION,
        senders : senders});
});

module.exports = router;
