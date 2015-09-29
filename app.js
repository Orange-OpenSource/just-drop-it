var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var send = require('./routes/send');
var receive = require('./routes/receive')
var javascript = require('./routes/javascript');

var app = express();

global.DROP_IT_VERSION=2.0

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(__dirname + '/public/images/favicon.png'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.receive_uri_path = '/receive';
app.use('/', send);
app.use(app.receive_uri_path, receive);
app.use('/js', javascript);

app.use(function (req,res,next) {
    console.log("cookies ",req.cookies);
    next();
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    console.log("not found");
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    console.log("enabling stacks");
    app.use(function(err, req, res, next) {
        console.error(err);
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}



// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


app.prepareStream = receive.prepareStream;
app.addReceiver = receive.addReceiver;
app.removeReceiver = receive.removeReceiver;
app.removeStream  = receive.removeStream;

module.exports = app;

