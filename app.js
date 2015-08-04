var express = require('express');
var session = require('express-session');
var handlebars = require('express-handlebars');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var SequelizeStore = require('connect-session-sequelize')(session.Store);

var db = require('./models/index');

var routes_index = require('./routes/index');
var routes_auth = require('./routes/auth');
var routes_papers = require('./routes/papers');
var routes_registration = require('./routes/registration');
var routes_desk = require('./routes/desk');

var app = express();

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/config/config.json')[env];
var utils = require('./utils')

// view engine setup
var hbs = handlebars.create({
  defaultLayout: 'main',
  extname: '.hbs',
  helpers: {
    breaklines: function(text) {
      return text
      text = handlebars.handlebars.Utils.escapeExpression(text);
      text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
      return new handlebars.handlebars.SafeString(text);
    },
    currency_symbol: function(currency) {
      return config['registration']['currencies'][currency]['symbol'];
    },
    has_permission: utils.has_permission,
    ifEqual: function(v1, v2, options) {
      if(v1 == v2) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  }
});
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

// Session setup
app.use(session({
  secret: config['secret'],
  resave: false,
  saveUninitialized: false,
  store: new SequelizeStore({
    db: db.sequelize
  }),
  cookie: {
    secure: false
  }
}));

// Export some stuff into the templates
app.use(function(req, res, next) {
  res.locals.session = req.session;
  res.locals.config = config;
  res.locals.req = { body: req.body,
                     query: req.query };
  res.locals.development = env == 'development';
  next();
});

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Get user if we have any
app.use(utils.get_user);

// Routing
app.use('/', routes_index);
app.use('/auth', routes_auth);
app.use('/papers', routes_papers);
app.use('/registration', routes_registration);
app.use('/desk', routes_desk);

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
