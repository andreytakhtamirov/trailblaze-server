const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var AuthAppToken = require('./middleware/appToken');

var routesRouter = require('./routes/routes');
var routesV1Router = require('./routes/v1/routes');
var postsRouter = require('./routes/posts');
var usersRouter = require('./routes/users');
var usersV1Router = require('./routes/v1/users');

var app = express();

// Enable CORS
app.use(cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Require app token to be present for all requests.
app.use(AuthAppToken);

// Enable the use of request body parsing middleware
app.use(bodyParser.json({
  // This is needed to be able to accept 
  //  large route data in the request body.
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use('/routes', routesRouter);
app.use('/v1/routes', routesV1Router);
app.use('/posts', postsRouter);
app.use('/users', usersRouter);
app.use('/v1/users', usersV1Router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
