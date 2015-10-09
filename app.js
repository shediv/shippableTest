var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var cors = require('express-cors');
var multer = require('multer');
var jwt = require('jsonwebtoken');
var RoutesCollection = require('./app/models/routesCollection').RoutesCollection;

var config = require('./app/config/config.js');

var routes = require('./app/routes/index');
var user = require('./app/routes/user');
var magazine = require('./app/routes/magazine');
var cinema = require('./app/routes/cinema');
var radio = require('./app/routes/radio');
var airport = require('./app/routes/airport');
var outdoor = require('./app/routes/outdoor');
var television = require('./app/routes/television');
var newspaper = require('./app/routes/newspaper');
var media = require('./app/routes/media');
var geography = require('./app/routes/geography');
var nonTraditional = require('./app/routes/nonTraditional');
var digital = require('./app/routes/digital');
var lsquare = require('./app/routes/lsquare');
var _12thCross = require('./app/routes/12thCross');
var search = require('./app/routes/search');
var bestRates = require('./app/routes/bestRates');
var cafe = require('./app/routes/cafe');
var mtwenty = require('./app/routes/mtwenty');
var parseExcel = require('./app/routes/parseExcel');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'app/views'));
app.set('view engine', 'jade');

app.use(cors({
    allowedOrigins: [
        'http://tma.dev', 'http://beta.themediaant.com', 'http://localhost', 'http://dev1.themediaant.com', 'http://themediaant.com'
    ],
	headers: [
		'x-access-token', 'Content-Type'
	]
}));

mongoose.connect(config.mongoUrl);

app.use(logger('dev'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
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
app.use('/mtwenty', mtwenty);
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