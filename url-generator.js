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
var fs = require('fs');
var debug = require('debug')('app:url-generator');
var error = require('debug')('app:url-generator');
debug.log = console.log.bind(console);


var UriGenerator = function() {
    this.adj = [];
    this.adv = [];
    this.noun = [];
    var that = this;

    function oneFileLoadingReady() {
        if (that.adj.length != 0 && that.adv.length != 0 && that.noun.length != 0) {
            debug("url generator is ready. have a sample = %s", that.generateUrl());
        }
    }

    //async load of the file content in memory
    fs.readFile('data/adj-short', function(err, data) {
        if(err) {
            error(err);
        }
        that.adj = data.toString().split("\n");
        oneFileLoadingReady();
    });
    fs.readFile('data/adv-short', function(err, data) {
        if(err) {
            error(err);
        }
        that.adv = data.toString().split("\n");
        oneFileLoadingReady();
    });
    fs.readFile('data/noun-short', function(err, data) {
        if(err) {
            error(err);
        }
        that.noun = data.toString().split("\n");
        oneFileLoadingReady();
    });
};

UriGenerator.prototype.generateUrl = function () {
    if (this.adj.length == 0 || this.adv.length == 0 || this.noun.length == 0){
        error("url generation not ready: file are not all loaded");
        return null;
    } else {
        return this.adv[Math.floor(Math.random() * this.adv.length) + 1] + '-' +
            this.adj[Math.floor(Math.random() * this.adj.length) + 1] + '-' +
            this.noun[Math.floor(Math.random() * this.noun.length) + 1];
    }
};



module.exports = new UriGenerator();







