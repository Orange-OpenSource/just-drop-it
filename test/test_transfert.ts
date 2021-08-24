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

import {Server} from "http";

let should = require('should');

let io = require('socket.io-client');
let ss = require('socket.io-stream');
let stream = require('stream');
let request = require('request');
let defaultDebugMode = "app:*";
if (typeof process.env.DEBUG == "undefined") {
    console.log("Adding DEBUG variable to " + defaultDebugMode);
    process.env.DEBUG = defaultDebugMode;
} else {
    console.log("DEBUG already set to " + defaultDebugMode);
}

let host = "localhost";
let port = 8081;

let urlConnection = "http://" + host + ":" + port;

function log(msg: string) {
    console.log("\n" + msg + "\n");
}

import {App} from "../server/app";
import {IoServerWrapper} from "../server/ioserver";

let http = require('http');
let fakeUri = 'test-download';

describe('Transfer test', function () {
    let httpServer: Server | undefined;

    let ioServerWrapper: any = null;

    const appWrapper = new App();
    const app = appWrapper.app;
    before(function (done) {

        httpServer = http.createServer(app);
        ioServerWrapper = new IoServerWrapper();
        ioServerWrapper.wrapServer(appWrapper.receiverServePagePath, appWrapper.receiverDownloadPath, httpServer);
        httpServer?.listen(port, host, function () {
            done();
        });
    });

    beforeEach(function (done) {
        /*log("beforeEach called");*/
        done();
    });

    afterEach(function (done) {
        /*log("afterEach called");*/
        done();
    });

    after(function (done) {
        if (httpServer != null) {
            log("closing httpServer");
            httpServer.close(function () {
                log('server closed');
                done();
            });
        } else {
            log("httpServer is null");
            done();
        }
    });

    function buildConnection(uri: string) {
        let result = io(urlConnection + uri, {'force new connection': true});

        result.on('error', function () {
            should.not.exist("Connection error");
        });

        result.shouldNotAlert = function () {
            result.on('alert', function (msg: string) {
                result.close(true);
                should.not.exist(msg);
            });
            return result;
        };
        return result;
    }

    let fileName = "toto.jpg";
    let transmittedData = "Some data to transmit";
    let size = transmittedData.length;

    describe("Connection", function () {
        it('should connect', function (done) {
            let socket = buildConnection("");
            socket.on('connect', function () {
                log("connection done on " + urlConnection);
                socket.close(true);
                done();
            });
        });

    });

    describe('Sender', function () {
        it('should receive url ready', function (done) {
            let socket = buildConnection("/send").shouldNotAlert();


            socket.on('connect', function () {
                socket.emit('snd_file_ready', {
                    size: size,
                    name: fileName
                });
            });
            const regex = new RegExp(appWrapper.receiverServePagePath+".*-.*-.*");
            socket.on('server_rcv_url_generated', function (url: any) {
                should(url).match(regex)
                socket.close(true);
                done();
            });
        });
    });

    describe('Receiver', function () {
        it('should receive unknown sender (bad sender)', function (done) {
            let socket = buildConnection("/receive");
            let unknownSenderId = 'unknown';
            socket.on('alert', function (msg: string) {
                socket.close(true);
                should(msg).be.equal('unknown senderID: ' + unknownSenderId);
                done();
            });

            socket.emit('rcv_sender', unknownSenderId)
        });

    });

    describe('Sender/receiver', function () {
        function buildUntilStreamReady(onStreamReady: any, data: any) {
            let sender = buildConnection('/send').shouldNotAlert();

            sender.on('connect', function () {
                sender.emit('snd_file_ready', {
                    size: size,
                    name: fileName
                });
                let senderId = ioServerWrapper.extractSenderId(sender);

                sender.on('server_rcv_url_generated', function (url: string) {
                    log('server_rcv_url_generated: ' + url);
                    let receiver = buildConnection("/receive").shouldNotAlert();
                    let receiverId;
                    receiver.on('connect', function () {
                        receiverId = ioServerWrapper.extractReceiverId(receiver);
                        receiver.emit('rcv_sender', senderId);
                    });


                    receiver.on('server_stream_ready', function (urlStream: string) {
                        log('stream_ready: ' + urlStream);
                        onStreamReady(sender, receiver, urlStream);

                    });

                    sender.on('server_receiver_ready', function (receiverId: string) {
                        log('server_receiver_ready: ' + receiverId);
                        let ssStream = ss.createStream();
                        ss(sender).emit('snd_send_file', ssStream, receiverId);
                        //should(receiverId).be.equal(receiver.id); receiver.id may be undefined since connection may be not done
                        if (typeof data != "undefined") {
                            let fakeStream = new stream();
                            fakeStream.pipe = function (dest:any) {
                                dest.write(data);
                                log('data transmitted: ' + data.length);
                                return dest;
                            };
                            fakeStream.pipe(ssStream);
                        }

                    });

                });
            });


        }

        it('should notify receiver left', function (done) {
            buildUntilStreamReady(function (sender:any, receiver:any) {
                let receiverId = ioServerWrapper.extractReceiverId(receiver);
                sender.on('server_receiver_left', function (disconnectedReceiverId:string) {
                    should(disconnectedReceiverId).be.equal(receiverId);
                    sender.close(true);
                    done();
                });
                receiver.close(true);
            }, undefined);

        });

        it('should notify sender left', function (done) {
            buildUntilStreamReady(function (sender:any, receiver:any) {
                receiver.on('server_sender_left', function () {
                    receiver.close(true);
                    done();
                });
                sender.close(true);
            }, undefined);

        });


        it('should transmit to the receiver', function (done) {
            buildUntilStreamReady(function (sender:any, receiver:any, urlStream:string) {
                should(urlStream).be.equal(appWrapper.receiverDownloadPath + ioServerWrapper.extractSenderId(sender) + '/' + ioServerWrapper.extractReceiverId(receiver));
                sender.close(true);
                receiver.close(true);
                done();
            }, undefined);
        });

        it('should transmit data to the receiver', function (done) {
            buildUntilStreamReady(function (sender:any, receiver:any, urlStream:string) {
                let data: string[] = [];
                request
                    .get(urlConnection + urlStream)
                    .on('error', function () {
                        should.not.exist("Connection error");
                        sender.close(true);
                        receiver.close(true);
                        done();
                    })
                    .on('response', function () {

                    })
                    .on('data', function (chunk: any) {
                        data.push(chunk);
                    }).on('complete', function (response: any) {
                    should(response.statusCode).be.equal(200);
                    let dataReceived = data.join('');
                    should(dataReceived).be.equal(transmittedData);
                    sender.close(true);
                    receiver.close(true);
                    done();
                });
            }, transmittedData);
        });

    });


});