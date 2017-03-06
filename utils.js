var utils = {}

var config = require('./configuration');

var models = require('./models');
var User = models.User;
var Email = models.Email;

var countries = require('country-data').countries;
countries.all_assigned = (countries.all
  .filter(function(c) { return c.status == 'assigned'; })
  .sort(function(a, b) { return a.name.localeCompare(b.name); }));

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

// Given a price in one currency, generate text showing the prices in all
// configured currencies.
var render_cost_in_currencies = function(cost, main_currency, currencies) {
  var list = [currencies[main_currency].symbol + Math.ceil(cost)];
  Object.keys(currencies).forEach(function(id) {
    if (id != main_currency)
      list.push(currencies[id].symbol + Math.ceil(cost * currencies[id].conversion_rate));
  });
  return list.join(' / ');
};

const fill_reg_fields_from_stored_registration = function(fields, registration) {
  // Each RegistrationInfo record in the database stores a single field+value
  // pair for the given user.
  for(var info in registration.RegistrationInfos) {
    info = registration.RegistrationInfos[info];
    var field = fields[info.field];
    field.value = info.value;

    if (field.type == 'purchase' && info.RegistrationPayment != null) {
      if (info.RegistrationPayment.paid == false) {
        field.payment_state = 'pending';
        field.can_change = false;
      } else {
        field.payment_state = 'paid';
        field.can_change = false;
      }
    }
  }
}

const fill_reg_fields_from_form_submission = function(fields, request_body) {
  for(var field in fields) {
    if (fields[field].type == "boolean") {
      // Checkbox <input> tags send no value when unchecked, so we need to set
      // a default for each 'boolean' type field.
      fields[field].value = "false";
    }

    if (('field_' + field) in request_body) {
      if (fields[field].type == "boolean") {
        // Any value for a boolean indicates the <input> was checked.
        fields[field].value = "true";
      } else {
        fields[field].value = request_body['field_' + field];
      }
    }
  };
};

// List all registration fields that are defined in the configuration file.
//
// Returns an array of objects representing the fields.
//
// The keys of the array are the field names from the config file.
//
// Each field object carries the properties that were defined in the
// config file. See README.md for documentation of those.
//
// Additional properties that are set by this function:
//
//   - `value`: set from the optional `request` parameter (which should be an
//     appropriate HTTP POST request) or `registration` parameter (which should
//     be a models.Registration object).
//   - `payment_state`: for purchase fields, can be one of "unpaid", "pending"
//     or "paid". Only set if the `registation` parameter was set.
//   - `can_change`: true if the field can be changed. We don't allow changing
//     purchase fields if a payment has already been made.
//
// NOTE: you must ensure the associations are queried for the Registration
// object, or payments will silently be ignored. Use the following code:
//
//    user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
//
utils.get_reg_fields = function (request, registration, skip_internal) {
  if (request)
    console.log("Update reg fields: req.body: %j", request['body']);
  var fields = {};
  for(var field_name in config['registration']['fields']) {
    if (skip_internal && config['registration']['fields'][field_name]['internal'])
      continue;

    fields[field_name] = Object.assign({}, config['registration']['fields'][field_name]);

    var field = fields[field_name];

    field.can_change = true;

    if(field['type'] == 'country') {
      field['type'] = 'select';
      var options = Object.assign([], field['options']);
      for(var country in countries.all_assigned) {
        options.push(countries.all_assigned[country].name);
      };
      field['options'] = options;
    }
    else
    if (field['type'] == 'purchase') {
      field['payment_state'] = 'unpaid';
      Object.keys(field['options']).forEach(function (option_name) {
        var option = field['options'][option_name];
        option['cost_all_currencies'] = render_cost_in_currencies(
                option['cost'], config.registration.main_currency,
                config.registration.currencies);
      });
    }

    // Some properties can be given as a list of strings. This is a
    // workaround because JSON syntax doesn't support multiline strings.
    ['html', 'message', 'text'].forEach(function(field_name) {
      if (field[field_name] instanceof Array)
        field[field_name] = field[field_name].join('');
    })
  };

  // Values in the request body (i.e. a new form submission) override values
  // from the stored registration.
  if (registration) {
    fill_reg_fields_from_stored_registration(fields, registration);
  }

  if (request) {
    fill_reg_fields_from_form_submission(fields, request.body);
  }

  return fields;
}

// Get information about the new purchase choices from a given registration.
//
// Returns an array of objects, which for each purchase lists the name of
// the field, the name of the chosen option, the cost of that option (in
// `currency`), and whether payment was made yet.
utils.get_reg_purchase_choices = function(reg, fields, currency_id) {
  var currency = config.registration.currencies[currency_id]
  var conversion_rate = currency.conversion_rate;
  var result = [];
  Object.keys(fields).forEach(function(field_name) {
    var field = fields[field_name];
    if (field.type == 'purchase') {
      var option = field['options'][field['value']];
      if (option) {
        var payment = reg.get_payment_for_purchase(field_name);
        result.push({
          'field_name': field_name,
          'field_display_name': field['display_name'],
          'option_name': field['value'],
          'option_display_name': option['display_name'] || field['value'],
          'cost': Math.ceil(option.cost * conversion_rate),
          'cost_display': currency.symbol + Math.ceil(option.cost * conversion_rate),
          'paid': payment != null && payment.paid
        });
      };
    };
  });
  return result;
};

utils.get_reg_purchase_choices_unpaid = function(reg, fields, currency_id) {
  var purchase_choices = utils.get_reg_purchase_choices(reg, fields, currency_id);
  return purchase_choices.filter(function(purchase) { return (purchase.paid == false) });
}

utils.get_reg_purchase_choices_paid = function(reg, fields, currency_id) {
  var purchase_choices = utils.get_reg_purchase_choices(reg, fields, currency_id);
  return purchase_choices.filter(function(purchase) { return (purchase.paid == true) });
}

utils.make_paypal_sku_for_purchase = function(field_name, option_name) {
  return [ config.registration.payment_sku_prefix, field_name, option_name ]
  .map(function (str) { return str.replace(':', '_'); })
  .join(':')
  .substring(0, 127);
};

module.exports = utils;
