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

var should = require('should');
var mockery = require('mockery');
var io = require('socket.io-client');
var ss = require('socket.io-stream');
var stream = require('stream');
var request = require('request');

var defaultDebugMode = "app:*";
if (typeof process.env.DEBUG == "undefined") {
    console.log("Adding DEBUG variable to " + defaultDebugMode);
    process.env.DEBUG = defaultDebugMode;
} else {
    console.log("DEBUG already set to " + defaultDebugMode);
}

var host = "localhost";
var port = 8081;

var urlConnection = "http://" + host + ":" + port;

function log(msg) {
    console.log("\n" + msg + "\n");
}

var app = require('../app');
var http = require('http');

describe('Rest Developers Api', function () {
    var httpServer = null;

    before(function (done) {
        mockery.enable(); // Active mockery au debut des tests
        mockery.warnOnUnregistered(false);


        httpServer = http.createServer(app);
        require("../ioserver")(app, httpServer);
        httpServer.listen(port, host, function () {

            done();
        });
    });

    beforeEach(function (done) {
        log("beforeEach called");
        done();
    });

    afterEach(function (done) {
        log("afterEach called");
        done();
    });

    after(function (done) {
        if (httpServer != null) {
            log("closing httpServer");
            httpServer.close(function () {
                log('server closed');
                mockery.deregisterAll();
                mockery.disable();
                done();
            });
        }
        else {
            log("httpServer is null");
            mockery.deregisterAll();
            mockery.disable();
            done();
        }
    });

    function buildConnection(extraOpts) {
        var result;
        if (typeof extraOpts == "undefined")
            result = io(urlConnection, {'force new connection': true});
        else {
            extraOpts['force new connection'] = true;
            result = io(urlConnection, extraOpts);
        }
        result.on('error', function () {
            should.not.exist("Connection error");
        });

        result.shouldNotAlert = function () {
            result.on('alert', function (msg) {
                socket.close(true);
                should.not.exist(msg);
            });
            return result;
        }
        return result;
    }

    var fileName = "toto.jpg";
    var transmittedData = "Some data to transmit";
    var size = transmittedData.length;

    describe("Connection", function () {
        it('should connect', function (done) {
            var socket = buildConnection();
            socket.on('connect', function () {
                log("connection done on " + urlConnection);
                socket.close(true);
                done();

            });
        });
        it('should receive missing profile alert', function (done) {
            var socket = buildConnection();

            socket.on('alert', function (msg) {
                socket.close(true);
                should.equal(msg, 'Error, no profile transmitted');
                done();

            });
        });


    });

    describe('Sender', function () {
        it('should receive url ready', function (done) {
            var socket = buildConnection({query: 'role=sender'}).shouldNotAlert();


            socket.on('connect', function () {
                socket.emit('file_ready', {
                    size: size,
                    name: fileName
                });
            });
            socket.on('receive_url_ready', function (url) {
                should(url).be.equal(app.receive_uri_path + '/' + socket.id);
                socket.close(true);
                done();
            });
        });
    });

    describe('Receiver', function () {
        it('should receive unknown sender (bad sender)', function (done) {
            var socket = buildConnection({query: 'role=receiver&senderID=toto'});

            socket.on('alert', function (msg) {
                socket.close(true);
                should(msg).be.equal('unkown senderID');
                done();
            });
        });


        it('should receive unknown sender (no sender)', function (done) {
            var socket = buildConnection({query: 'role=receiver'});

            socket.on('alert', function (msg) {
                socket.close(true);
                should(msg).be.equal('unkown senderID');
                done();
            });
        });
    });

    describe('Sender/receiver', function () {
        function buildUntilStreamReady(onStreamReady, data) {
            var sender = buildConnection({query: 'role=sender'}).shouldNotAlert();

            sender.on('connect', function () {
                sender.emit('file_ready', {
                    size: size,
                    name: fileName
                });
            });


            sender.on('receive_url_ready', function (url) {
                log('receive_url_ready: ' + url);
                var receiver = buildConnection({query: 'role=receiver&senderID=' + sender.id}).shouldNotAlert();
                var receiverId;
                receiver.on('connect', function () {
                    receiverId = receiver.id;
                })


                receiver.on('stream_ready', function (urlStream, receivedFileName, receivedSize) {
                    log('stream_ready: ' + urlStream);
                    onStreamReady(sender, receiver, urlStream, receivedFileName, receivedSize);

                });

                sender.on('receiver_ready', function (receiverId) {
                    log('receiver_ready: ' + receiverId);
                    var ssStream = ss.createStream();
                    ss(sender).emit('send_file', ssStream, receiverId, fileName, size);
                    //should(receiverId).be.equal(receiver.id); receiver.id may be undefined since conection may be not done
                    if (typeof data != "undefined") {
                        var fakeStream = new stream();
                        fakeStream.pipe = function (dest) {
                            dest.write(data);
                            log('data transmitted: ' + data.length);
                            return dest;
                        };
                        fakeStream.pipe(ssStream);
                    }

                });

            });
        }

        it('should notify receiver left', function (done) {
            buildUntilStreamReady(function (sender, receiver, urlStream, receivedFileName, receivedSize) {
                var receiverId = receiver.id;
                sender.on('receiver_left', function (disconnectedReceiverId) {
                    should(disconnectedReceiverId).be.equal(receiverId);
                    sender.close(true);
                    done();
                });
                receiver.close(true);
            });

        });

        it('should notify sender left', function (done) {
            buildUntilStreamReady(function (sender, receiver, urlStream, receivedFileName, receivedSize) {
                receiver.on('sender_left', function () {
                    receiver.close(true);
                    done();
                });
                sender.close(true);
            });

        });


        it('should transmit to the receiver', function (done) {
            buildUntilStreamReady(function (sender, receiver, urlStream, receivedFileName, receivedSize) {
                should(receivedFileName).be.equal(fileName);
                should(receivedSize).be.equal(size);
                should(urlStream).be.equal(app.receive_uri_path + '/data/' + sender.id + '/' + receiver.id);
                sender.close(true);
                receiver.close(true);
                done();
            });
        });

        it('should transmit data to the receiver', function (done) {
            buildUntilStreamReady(function (sender, receiver, urlStream) {
                var data = [];
                request
                    .get(urlConnection + urlStream)
                    .on('error', function (err) {
                        should.not.exist("Connection error");
                        sender.close(true);
                        receiver.close(true);
                        done();
                    })
                    .on('response', function (response) {

                    })
                    .on('data', function (chunk) {
                        data.push(chunk);
                    }).on('complete', function(response,body){
                        should(response.statusCode).be.equal(200);
                        var dataReceived = data.join('');
                        should(dataReceived).be.equal(transmittedData);
                        sender.close(true);
                        receiver.close(true);
                        done();
                    });
            }, transmittedData);
        });

    });


})