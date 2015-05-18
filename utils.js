var utils = {}

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/config/config.json')[env];

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
  console.log("Current:");
  console.log(options);
  console.log("Param:");
  console.log(permission);
  if(get_permission_checker(permission, options.data.root.session.currentUser))
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

module.exports = utils;
