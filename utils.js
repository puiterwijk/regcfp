var utils = {}

var config = require('./configuration');

var models = require('./models');
var User = models.User;
var Email = models.Email;

var extend = require('util')._extend;
var countries = require('country-data').countries;

function get_permission_checker(permission) {
  var required = permission.split('/');
  var allowed = config.permissions;
  for(var i = 0; i < required.length; i++)
  {
    if(typeof allowed == 'undefined') {
      console.log("Permission checker for unspecified permission requested: " + permission);
      return function(username) {
        return false;
      }
    };
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
utils.get_permission_checker = get_permission_checker;

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
  if(typeof permission === 'string') {
    permission = [permission];
  }

  var checkers = [];
  for(var perm in permission) {
    perm = permission[perm];
    checkers.push(get_permission_checker(perm));
  }

  return function(req, res, next) {
    var has_one = false;
    for(var checker in checkers) {
      checker = checkers[checker];
      if(checker(req.session.currentUser)) {
        has_one = true;
        break;
      }
    }

    if(has_one)
    {
      next();
    }
    else
    {
      console.log("Unauthorized request: " + req.session.currentUser + " needed " + permission);
      res.status(401).render('auth/no_permission', { required_permission: JSON.stringify(permission) });
    }
  };
};

utils.require_login = function(req, res, next) {
  if(req.session.currentUser == null) {
    res.status(401).render('auth/no_permission', { required_permission: 'Login' });
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
  .catch(function(error) {
    res.status(500).send('Error retrieving user object');
  })
  .then(function(user) {
    if(user) {
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
    res.status(401).render('auth/no_permission', { required_permission: 'Login' });
    return;
  }

  if(!req.user) {
    // Redirect to register
    res.redirect(302, '/authg/register?origin=' + req.originalUrl);
  } else {
      next();
  }
};

utils.send_email = function(req, res, recipient, template, variables, cb) {
  if(recipient == null) {
    recipient = req.user.id;
  } else {
    recipient = recipient.id;
  }

  variables.layout = false;
  req.app.render('email/' + template, variables, function(err, html) {
    if(!!err) {
      console.log('Error rendering email: ' + err);
      res.status(500).send('Error rendering email');
      return null;
    } else {
      var split = html.split('\n');
      var subject = split[0];
      var contents = split.slice(2).join('\n');

      var info = {
        UserId: recipient,
        sent: false,
        subject: subject,
        body: contents
      };
      Email.create(info)
      .catch(function(err) {
        console.log('Error saving email: ' + err);
        res.status(500).send('Error sending email');
        return null;
      })
      .then(function(err, email) {
        cb();
      });
    }
  });
};

utils.get_reg_fields = function (request, registration, skip_internal) {
  var fields = {};
  for(var field in config['registration']['fields']) {
    if (skip_internal && config['registration']['fields'][field]['internal'])
      continue;

    fields[field] = extend({}, config['registration']['fields'][field]);
    if(fields[field]['type'] == 'country') {
      fields[field]['type'] = 'select';
      var options = fields[field]['options'];
      if (options === undefined)
        options = [];
      for(var country in countries.all) {
        options.push(countries.all[country].name);
      };
      fields[field]['options'] = options;
    }
  };
  if(request)
    console.log(request.body);
  for(field in fields) {
    if(request && ('field_' + field) in request.body) {
      fields[field].value = request.body['field_' + field];
    } else if(registration != null) {
      for(var info in registration.RegistrationInfos) {
        info = registration.RegistrationInfos[info];
        if(info.field == field) {
          fields[field].value = info.value;
        }
      }
    } else {
      fields[field].value = '';
    }
  };
  return fields;
}

module.exports = utils;
