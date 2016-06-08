# Just Drop It


## Goal
Working in companies, we have been confronted with proxies and tool that are hard to use.
The aim of the _just drop it_ is to allow its users to transfert files through the network by using **http** and **websocket** protocols.

## Design
All the sender has to do is to navigate to the site where _just drop it_ is deployed, give a file using the form, and then a link will be given. He only has to give the link to any receivers he wants, **provided that** he does not close its window. The link will remain active as long as he lets his window opened.

## Framework
To meet the requirements, we chose the followings:

- [Node Js](https://nodejs.org/)
- [Express](http://expressjs.com/)
- [socket.io](http://socket.io/): this allows us communication between clients and server.
- [socket.io stream](https://github.com/nkzawa/socket.io-stream): this allows us to stream the file between sender and server.

## Error handling
Handling network cutting is a hassle. The most common scenario is the following:

- a big file transfert is ongoing
- one of the proxies cut the transfert connection
- Not only neither the server nor the receiver are notified that the transfert failed, but also will the download in browser be let in a *success* state, even if all the file size was not received.

In order to provide a better monitoring, the number of bytes written on the http download socket are monitored, allowing us to:

- provide real download progress
- close a transfert that has been closed by the network
- control that when a socket is closed, all the file size bytes has been written on it




