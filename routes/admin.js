/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This file is part of just-drop-it.
 *
 * just-drop-it is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with just-drop-it.  If not, see <http://www.gnu.org/licenses/>.
 */

var express = require('express');
var debug = require('debug')('app:routes:admin');
var router = express.Router();
var dao    = require("../server/dao");


debug.log = console.log.bind(console);

/* GET home page. */
router.get('/', function(req, res) {
    var senders = [];
    dao.eachSenders(function(sender){
        var senderObj = {id : sender.senderId, receivers : [], fileName: sender.fileName};
        sender.eachReceiver(function(receiver){
            senderObj.receivers.push(receiver.receiverId);
        });
        senders.push(senderObj);
    });
    res.render('admin', {title : "Just drop it Admin",
        isLocal : typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
        jdropitVersion : global.DROP_IT_VERSION,
        dumbContent : "",
        senders : senders});
});

module.exports = router;
