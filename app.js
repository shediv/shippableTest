var express = require('express');
var path = require('path');
//var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var cors = require('express-cors');
var multer = require('multer');
var config = require('./config.js');
var routes = require('./routes/index');
var user = require('./routes/user');
var magazine = require('./routes/magazine');
var cinema = require('./routes/cinema');
var radio = require('./routes/radio');
var newspaper = require('./routes/newspaper');
var media = require('./routes/media');
var geography = require('./routes/geography');
var parseExcel = require('./routes/parseExcel');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors({
    allowedOrigins: [
        'http://tma.dev', 'http://beta.themediaant.com', 'http://localhost', 'http://dev1.themediaant.com'
    ],
	headers: [
		'x-access-token', 'Content-Type'
	]
}));

mongoose.connect(config.mongoUrl);

//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(multer({dest: './public/temp/'}).single('file'));

app.use('/user', user);
app.use('/magazine', magazine);
app.use('/cinema', cinema);
app.use('/radio', radio);
app.use('/newspaper', newspaper);
app.use('/media', media);
app.use('/geography', geography);
app.use('/parseExcel', parseExcel);

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
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


module.exports = app;
