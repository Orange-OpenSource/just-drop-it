/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This program is free software; you can redistribute it and/or
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
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";
var jdNotif = {

    checkNotifPermissions: function () {

        var notification = window.Notification || window.mozNotification || window.webkitNotification;

        if ('undefined' === typeof notification) {
            console.log('Web notification not supported');
        } else {
            notification.requestPermission(function (permission) {
                console.log(permission);
            });
        }
    },


    notify: function (titletxt, bodytxt) {
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

        return false;
    },


}