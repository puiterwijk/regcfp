var utils = {}

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/config/config.json')[env];

var models = require('./models');
var User = models.User;

function get_permission_checker(permission) {
  var required = permission.split('/');
  var allowed = config.permissions;
  for(var i = 0; i < required.length; i++)
  {
    allowed = allowed[required[i]];
  }

  // This function return is so we can make it optimized for require_permission
  return function(username) {
    if(allowed.indexOf('*anonymous*') != -1)
    {
      return true;
    }
    else if((allowed.indexOf('*authenticated*') != -1) && (username != null))
    {
      return true;
    }
    else if(allowed.indexOf(username) != -1)
    {
      return true;
    }
    else
    {
      return false;
    }
  };
};

utils.has_permission = function(permission, options) {
  if(get_permission_checker(permission)(options.data.root.session.currentUser))
  {
    return options.fn(this);
  }
  else
  {
    return options.inverse(this);
  }
};

utils.require_permission = function(permission) {
  var check_function = get_permission_checker(permission);

  return function(req, res, next) {
    if(check_function(req.session.currentUser))
    {
      next();
    }
    else
    {
      res.render('auth/no_permission', { required_permission: JSON.stringify(permission) });
    }
  };
};

utils.require_login = function(req, res, next) {
  if(req.session.currentUser == null) {
    res.render('auth/no_permission', { required_permission: 'Login' });
  } else {
    next();
  }
};

utils.require_feature = function(feature) {
  if(config[feature]['enabled']) {
    return function(req, res, next) {
      next();
    }
  } else {
    return function(req, res, next) {
      res.render('auth/no_permission', { required_permission: 'Feature disabled' });
    }
  }
};

utils.get_user = function(req, res, next) {
  if(!req.session.currentUser) {
    next();
    return;
  }
  User.find({
    where: {
      email: req.session.currentUser
    }
  })
  .complete(function(err, user) {
    if(!!err) {
      res.status(500).send('Error retrieving user object');
    } else if(user) {
      req.user = user;
      res.locals.user = user;
      next();
    } else {
      next();
    }
  });
}

utils.require_user = function(req, res, next) {
  if(!req.session.currentUser) {
    res.render('auth/no_permission', { required_permission: 'Login' });
    return;
  }

  if(!req.user) {
    // Redirect to register
    res.redirect(302, '/auth/register?origin=' + req.originalUrl);
  } else {
      next();
  }
};

module.exports = utils;
