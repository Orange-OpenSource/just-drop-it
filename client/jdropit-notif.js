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

"use strict";
var debug = require('debug')('justdropit:notif');
var jdNotif = (function(){
    var notification = window.Notification || window.mozNotification || window.webkitNotification;
    var result = {};

    result.isNotificationAvailable = function(){
        return 'undefined' !== typeof notification;
    };

    result.isAlreadyGranted = function(){
        return this.isNotificationAvailable() && notification.permission === 'granted';
    };


    result.askPermission = function (callback) {
        if (this.isNotificationAvailable()) {
            debug("requesting permission");
            notification.requestPermission(function (permission) {
                debug(permission);
                callback();
            });
        }
    };



    result.notify =  function (titletxt, bodytxt) {
        if(this.isNotificationAvailable()){
            var instance = new Notification(
                titletxt, {
                    body: bodytxt,
                    icon: '/favicon.ico',
                    tag: 'justdrop-it notif'
                }
            );

            instance.onclick = function () {
                // Something to do
            };
            instance.onerror = function () {
                // Something to do
            };
            instance.onshow = function () {
                // Something to do
            };
            instance.onclose = function () {
                // Something to do
            };
        }
        return false;
    };
    return result;
})();