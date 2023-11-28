# Just Drop It

> ⚠️ **Please note that this project has been archived and is no longer maintained**

[![Build Status](https://travis-ci.org/Orange-OpenSource/just-drop-it.svg?branch=master)](https://travis-ci.org/Orange-OpenSource/just-drop-it)

just-drop-it allows you to simply and instantly send a file to a friend, whatever your network configuration (proxies, VPN, and such). Just open your browser, drop the file in it and send the generated link to your friend : the file will be beamed to him without being stored on any platform.

### why would anyone do this?

We thought that this kind of tool was missing in our work environment, so we tried to set one up. Lucky for us, tools like [Node.js](https://nodejs.org/), [Express](http://expressjs.com/), [socket.IO](http://socket.io/) and [socket.IO-stream](https://github.com/nkzawa/socket.io-stream) made it quite easy to get something up and running.

## How to use it

It couldn't be more simple (but you will need a running  instance of just-drop-it. If you don't have one see [the section below](#how-to-run-it)

- open your just-drop-it in your browser
- drop your file (*just one please*)

![Droping a file](http://orange-opensource.github.io/just-drop-it/drop.png)

- send the generated link to your friends

![Sharing the link](http://orange-opensource.github.io/just-drop-it/link.png)

- **keep your browser open** until your friends received the complete file

![Watching the upload progress](http://orange-opensource.github.io/just-drop-it/transfer.png)

## How to run it

### On any computer

#### With Node.js

Download and install [Node.js](https://nodejs.org/download/). Then:

- Download the source code
- Download the needed dependencies (first time only): `npm install`
- Start Node.js server: `npm start` (to start the server in dev mode wit hot reload: `npm run start-dev`)

##### With docker

We provide our own docker image to deploy Node.js.

- Build the image (first time): `docker build -t just-drop-it .` (add `--build-arg HTTP_PROXY=http://proxy-host:<proxy-port> --build-arg HTTPS_PROXY=proxy-host:<proxy-port>` if you are running behind a proxy)
- Run the image (first time): `docker run --name just-drop-it -p 8080:8080 -d  just-drop-it` (next time you will just have to start it with `docker start just-drop-it`)

### on an OpenShift instance

just-drop-it should work on [OpenShift3](http://openshift.redhat.com/) instances. Just create a Node.js v6 app and synchronize its git repository with our.

## From a technical point of view

More details on our implementation, to be updated.

### Framework

To meet the requirements, we chose the followings:

- [Node.js](https://nodejs.org/)
- [Express](http://expressjs.com/)
- [socket.io](http://socket.io/): this allows us communication between clients and server.
- [socket.io stream](https://github.com/nkzawa/socket.io-stream): this allows us to stream the file between sender and server.

### Error handling

Handling network cutting is a hassle. The most common scenario is the following:

- a big file transfer is ongoing
- one of the proxies cut the transfer connection
- Not only neither the server nor the receiver are notified that the transfer failed, but also will the download in browser be let in a *success* state, even if all the file size was not received.

In order to provide a better monitoring, the number of bytes written on the http download socket are monitored, allowing us to:

- provide real download progress
- close a transfer that has been closed by the network
- control that when a socket is closed, all the file size bytes has been written on it
