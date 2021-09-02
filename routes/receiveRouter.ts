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

import Debug from "debug";
import {Dao} from "../server/dao";
import {NextFunction, Request, Response} from "express";
import {DisplayError} from "./displayError";

const debug = Debug("app:routes:receive");
const error = Debug("app:routes:receive");
debug.log = console.log.bind(console);

export class ReceiveRouter {
    router = require('express').Router();

    servePagePath = '/';
    downloadPath = '/data/';

    dao = Dao.getInstance();

    get() {
        let self = this;
        self.router.get(this.servePagePath + ':id', (req: Request, res: Response, next: NextFunction) => {
            const uri = req.params.id;
            self.dao.getSenderFromUri(uri, (sender) => {
                debug('receive - rendering receive for uri %s', uri);
                res.render('receive', {
                    isLocal: typeof process.env.OPENSHIFT_NODEJS_IP === "undefined",
                    jdropitVersion: process.env.npm_package_version,
                    infoMessage: typeof process.env.USER_INFO_MESSAGE === "undefined" ? "" : process.env.USER_INFO_MESSAGE,
                    dumbContent: "",
                    fileName: sender.fileName,
                    fileSize: sender.fileSize,
                    senderId: sender.senderId
                });
            }, () => {
                error('receive - file not found %s', uri);
                const err = new DisplayError('Unknown transfer reference');
                err.status = 404;
                err.sub_message = uri;
                next(err);
            });
        });


        this.router.get(self.downloadPath + ':id/:receiverId', (req: Request, res: Response, next: NextFunction) => {
            const fileId = req.params.id;
            const receiverId = req.params.receiverId;

            const getNumberOfBytesSent = () => {
                //req.socket or res.connection
                const socket = req.socket;
                return socket.bytesWritten + socket.writableLength;
            }

            const encodeFileName = (fileName: string) => {
                const result = [];
                for (let cpt = 0; cpt < fileName.length; cpt++) {
                    const currentChar = fileName[cpt];
                    if ((currentChar >= 'a' && currentChar <= 'z') || (currentChar >= 'A' && currentChar <= 'Z') || (currentChar >= '0' && currentChar <= '9')
                        || currentChar == '.' || currentChar == '_' || currentChar == '(' || currentChar == ')' || currentChar == '[' || currentChar == ']' || currentChar == ' ') {
                        result.push(currentChar);
                    }
                }
                return result.join('');
            }


            self.dao.getReceiver(fileId, receiverId, (receiver) => {
                debug('download - serving file %s', fileId);
                const initSize = getNumberOfBytesSent();
                const sendDate = false;
                const HEAD_SIZE_WITHOUT_FILE_NAME = sendDate ? 246 : 209;
                const CHECK_SEND_DELAY_IN_MS = 100;
                const TIMEOUT_IN_MS = 60 * 1000;


                //sends header to flush them
                const encodedFileName = encodeFileName(receiver.sender.fileName!);
                const headSize = encodedFileName.length + ('' + receiver.sender.fileSize).length + HEAD_SIZE_WITHOUT_FILE_NAME;

                debug("download - init - %d - sent", getNumberOfBytesSent());
                debug("download - file name length - %d", encodedFileName.length);
                debug("download - file size - %d", receiver.sender.fileSize);
                res.sendDate = sendDate;
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': receiver.sender.fileSize,
                    'Content-Disposition': 'attachment; filename="' + encodedFileName + '"',
                    'Set-Cookie': 'fileDownload=true; path=/'
                });


                receiver.stream.pipe(res);
                const getBodyWritten = () => {
                    return getNumberOfBytesSent() - headSize - initSize;
                }

                let lastNumberOfBytesSent = getBodyWritten();
                let lastPercentSent = 0;
                let numberOfCycleSameSize = 0;
                debug("download - %s  - after head - %d sent", receiverId, getNumberOfBytesSent());

                const sendPercent = (percent: number) => {
                    if (percent > lastPercentSent) {
                        receiver.notifySent(percent);
                        lastPercentSent = percent;
                    }
                }

                const notifySent = () => {
                    const nbBytesSent = getBodyWritten();
                    //Having a NaN here means the interval has not been cleared properly when it should have been
                    if (isNaN(nbBytesSent)) {
                        error("download - %s - task of notification has not been cleared properly", receiverId);
                        clearInterval(intervalId);
                    } else {
                        debug("%s  - running - %d sent", receiverId, nbBytesSent);
                        if (nbBytesSent > lastNumberOfBytesSent) {
                            numberOfCycleSameSize = 0;
                            lastNumberOfBytesSent = nbBytesSent;
                            if (nbBytesSent > 0) {
                                const percent = Math.floor((nbBytesSent * 100) / receiver.sender.fileSize!);
                                sendPercent(percent);
                            }
                        } else if (nbBytesSent >= receiver.sender.fileSize! || nbBytesSent < receiver.sender.fileSize!
                            && ++numberOfCycleSameSize == Math.floor(TIMEOUT_IN_MS / CHECK_SEND_DELAY_IN_MS)) {
                            //download is completed or user is in timeout. Forcing close of response
                            //that will trigger the finish/end event
                            res.end();
                        }
                    }
                }

                const intervalId = setInterval(notifySent, CHECK_SEND_DELAY_IN_MS);

                receiver.clean = () => {
                    clearInterval(intervalId);
                    const nbBytesSent = getBodyWritten();
                    if (!isNaN(nbBytesSent) && nbBytesSent < receiver.sender.fileSize! && res.socket != null) {
                        debug("download - closing active download of %s/%s", fileId, receiverId);
                        receiver.stream.unpipe(res);
                        res.socket.destroy();
                    }
                    debug("download - %s - end - %d sent", receiverId, isNaN(nbBytesSent) ? "???" : nbBytesSent.toString());
                };


                res.on('finish', () => {
                    debug("download - finish - event - %s", receiverId);
                    const nbBytesSent = getBodyWritten();
                    if (nbBytesSent < receiver.sender.fileSize!) {
                        error("download - %s - timeout/error", receiverId);
                        receiver.timeout();
                    } else {
                        debug("download - %s - totally sent", receiverId);
                        sendPercent(100);
                        receiver.completed();
                    }
                });
                res.on('close', () => {
                    error("download - %s - connection closed by other part", receiverId);
                    // to avoid unsync when client receiver is closing too fast: when receiving a close event, wait a few for last timer event. If sent = 100%, act as if normal completion
                    setTimeout(() => {

                        if(lastPercentSent != 100){
                            receiver.disconnected();
                        }else{
                            debug("unsync workaround")
                            receiver.completed();
                        }
                        },1000
                    );
                });

            }, () => {
                error('download - file not found or not prepared: %s/%s', fileId, receiverId);
                const err = new DisplayError('Unknown transfer reference');
                err.status = 404;
                err.sub_message = fileId + "/" + receiverId;
                next(err);
            });
        });
        return this.router
    }
}
