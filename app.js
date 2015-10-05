var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var cors = require('express-cors');
var multer = require('multer');
var jwt = require('jsonwebtoken');
var RoutesCollection = require('./models/routesCollection').RoutesCollection;

var config = require('./config.js');

var routes = require('./routes/index');
var user = require('./routes/user');
var magazine = require('./routes/magazine');
var cinema = require('./routes/cinema');
var radio = require('./routes/radio');
var airport = require('./routes/airport');
var outdoor = require('./routes/outdoor');
var television = require('./routes/television');
var newspaper = require('./routes/newspaper');
var media = require('./routes/media');
var geography = require('./routes/geography');
var nonTraditional = require('./routes/nonTraditional');
var digital = require('./routes/digital');
var lsquare = require('./routes/lsquare');
var _12thCross = require('./routes/12thCross');
var search = require('./routes/search');
var bestRates = require('./routes/bestRates');
var cafe = require('./routes/cafe');
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

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(multer({dest: './public/temp/'}).single('file'));

// check if login required
app.use(function(req, res, next) {
  RoutesCollection.findOne({url:req.url, isAuthReq:true}).lean().exec(
    function(err, result)
      {
        if(result){
          var token = req.body.token || req.query.token || req.headers['x-access-token'];
          if(!token) return res.status(401).json("Token not found");
          jwt.verify(token, config.secret, function(err, decoded){
            if(err) res.status(401).json("Invalid Token");
            else next();
          });          
        }
        else{
           next();
        }
      }
    );
});

app.use('/user', user);
app.use('/magazine', magazine);
app.use('/cinema', cinema);
app.use('/radio', radio);
app.use('/airport', airport);
app.use('/newspaper', newspaper);
app.use('/outdoor', outdoor);
app.use('/television', television);
app.use('/digital', digital);
app.use('/lsquare', lsquare);
app.use('/media', media);
app.use('/geography', geography);
app.use('/nonTraditional', nonTraditional);
app.use('/12thCross', _12thCross);
app.use('/search', search);
app.use('/bestRates', bestRates);
app.use('/cafe', cafe);
app.use('/parseExcel', parseExcel);

app.use('/', routes);

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