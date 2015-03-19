var utils = {}

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/config/config.json')[env];

utils.require_permission = function(permission) {
  var required = permission.split('/');
  var allowed = config.permissions;
  for(var i = 0; i < required.length; i++)
  {
    allowed = allowed[required[i]];
  }

  return function(req, res, next) {
    if(allowed.indexOf('*') != -1)
    {
      next();
    }
    else if((allowed.indexOf('*authenticated*') != -1) && (req.session.currentUser != null))
    {
      next();
    }
    else if(allowed.indexOf(req.session.currentUser) != -1)
    {
      next();
    }
    else
    {
      res.render('auth/no_permission', { required_permission: JSON.stringify(permission) });
    }
  };
};

module.exports = utils;
