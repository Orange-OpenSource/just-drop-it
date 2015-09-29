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