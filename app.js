var express = require('express');
var path = require('path');
//var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var cors = require('express-cors');
var multer = require('multer');
var jwt = require('jsonwebtoken');

var config = require('./app/config/config.js');
var envConfig = require('./app/config/config.env.js');

var routes = require('./app/routes/index');
var user = require('./app/routes/user');


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'app/views'));
app.set('view engine', 'jade');

app.use(cors({
    allowedOrigins: [
        'http://tma.dev',
        'http://themediaant.com',
        'http://www.themediaant.com',
        'http://testing.themediaant.com',
        'http://www.m20.in',
        'http://m20.in',
        'http://tma.dev:3000',
        'http://www.tma.dev:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
	headers: [
		'x-access-token', 'Content-Type'
	]
}));

mongoose.connect(envConfig.mongoUrl, function(err){
  if(err) mongooseLog('Mongoose error: ' + err);
});

//MONGODB CONNECTION EVENTS.
mongoose.connection
    .on('connected', function () {
        mongooseLog('Connection open to ' + envConfig.mongoUrl);
    })
    .on('error',function (err) {
        mongooseLog('Connection error: ' + err);
    })
    .on('disconnected', function () {
        mongooseLog('Connection disconnected');
    });

function mongooseLog(data) {
  return console.log(data);
}

app.use(function(req, res, next){
  console.log(  "\033[34m \033[1m" + req.method , 
                "\033[36m \033[1m REQUEST URL: " + "\033[32m "+req.url , 
                "\033[36m \033[1m REQUEST TIME: " + "\033[32m "+ new Date() + "\033[31m ");
  next();
});

//app.use(logger('dev'));

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(multer({dest: './public/temp/'}).single('file'));

// check if login required
// app.use(function(req, res, next) {
//   RoutesCollection.findOne({url:req.url, isAuthReq:true}).lean().exec(
//     function(err, result)
//     {
//       if(err) return res.status(500).json(err);
//       if(result){
//         var token = req.body.token || req.query.token || req.headers['x-access-token'];
//         if(!token) return res.status(401).json("Token not found");
//         jwt.verify(token, config.secret, function(tokenErr, decoded){
//           if(tokenErr) return res.status(401).json("Invalid Token");
//           else next();
//         });
//       }
//       else{
//          next();
//       }
//     }
//   );
// });

 
app.use('/user', user);
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
