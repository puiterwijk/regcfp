var express = require('express');
var router = express.Router();
var Promise = require("bluebird");

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;
var RegistrationInfo = models.RegistrationInfo;

var config = require('../configuration');

var paypal = require('paypal-rest-sdk');
paypal.configure(config['registration']['paypal']['api_credentials']);

function get_min_main() {
  // Get the minimum amount for receipt in local currency
  var main_currency = config['registration']['main_currency'];
  return config['registration']['currencies'][main_currency]['min_amount_for_receipt'];
}

router.all('/', utils.require_feature("registration"));

// Show all registrations.
//
// This function is used both for the public list (which shows the names only)
// and admin views (which show all info).
function show_list(req, res, next, show_private, show_payment) {
  var filter = {};
  var include = [User, RegistrationInfo];
  if(!show_private) {
    filter = { is_public: true };
  }
  if (show_payment) {
    include.push(RegistrationPayment);
  }
  Registration
    .findAll({
      where: filter,
      include: include
    })
    .then(function(registrations) {
      var field_ids = [null];
      var field_display_names = ['Name'];
      var fields = config['registration']['fields'];

      if (show_private) {
        field_display_names.push('Mail')
      }

      for(var field in fields) {
        if (fields[field]['type'] == 'documentation')
          continue;
        if(show_private || (!fields[field]['private'] && !fields[field]['internal'])) {
          field_ids.push(field);
          field_display_names.push(fields[field]['short_display_name']);
        }
      }

      if(show_payment) {
        field_display_names.push('Paid');
      }

      var display_regs = [];
      for(var registration in registrations) {
        registration = registrations[registration];
        var cur_reg = [];
        cur_reg.push(registration['User'].name);
        var field_values = utils.get_reg_fields(null, registration, !show_private);

        if (show_private) {
          cur_reg.push(registration['User'].email);
        }

        for(var field in field_ids) {
          field = field_ids[field];
          if(field != null) {
            cur_reg.push(field_values[field].value);
          }
        }
        if(show_payment) {
          var str = registration.paid;
          if (registration.has_outstanding_onsite)
            str = str + " (" + registration.outstanding_onsite + ")";
          cur_reg.push(str);
        }

        display_regs.push(cur_reg);
      }
      res.render('registration/list', { fields: field_display_names, registrations: display_regs });
    });
};

router.get('/', function(req, res, next) { res.redirect('/') });

router.all('/list', utils.require_permission('registration/view_public'));
router.get('/list', function(req, res, next) {
  return show_list(req, res, next, false);
});

router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('registration/view_all'));
router.get('/admin/list', function(req, res, next) {
  var show_payment = utils.get_permission_checker('registration/view_payment')(req.session.currentUser);
  return show_list(req, res, next, true, show_payment);
});

router.all('/pay', utils.require_user);
router.all('/pay', utils.require_permission('registration/pay'));
router.get('/pay', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment]}).then(function(reg) {
    var can_pay = utils.get_permission_checker("registration/pay")(req.session.currentUser);

    if (reg == null || !can_pay)
      res.redirect('/');
    else
      res.render('registration/pay', { registration: reg });
  });
});

router.post('/pay', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment]}).then(function(reg) {
    if(reg.regfee == null) {
      res.render('registration/pay');
    } else {
      res.render('registration/pay_do', {currency: reg.currency, regfee: reg.regfee});
    }
  });
});

router.all('/pay/paypal/return', utils.require_user);
router.all('/pay/paypal/return', utils.require_permission('registration/pay'));
router.get('/pay/paypal/return', function(req, res, next) {
  res.render('registration/pay_paypal', {currency: req.session.currency, regfee: req.session.regfee, payerId: req.query.PayerID, paymentId: req.query.paymentId});
});

router.all('/pay/paypal/execute', utils.require_user);
router.all('/pay/paypal/execute', utils.require_permission('registration/pay'));
router.post('/pay/paypal/execute', function(req, res, next) {
  console.log("VERIFYING PAYMENT");
  console.log('Payer: ' + req.body.payerId + ', paymentId: ' + req.body.paymentId);
  var execute_payment = {
    'payer_id': req.body.payerId,
    'transactions': [{
      'amount': req.session.payment['request']['transactions'][0]['amount']
    }]
  };
  console.log('Request');
  console.log(JSON.stringify(execute_payment));
  var paymentID = req.body.paymentId;
  paypal.payment.execute(paymentID, execute_payment, function(err, payment) {
    if(!!err) {
      console.log('ERROR');
      console.log(JSON.stringify(err));
      res.status(500).send('authorization-failure');
    } else {
      console.log('Response: ');
      console.log(JSON.stringify(payment));

      var info = {
        currency: payment.transactions[0]['amount']['currency'],
        amount: payment.transactions[0]['amount']['total'],
        paid: payment.state == 'approved',
        type: 'paypal',
        details: payment.id
      };
      console.log('Storing');
      console.log(info);

      RegistrationPayment.create(info)
      .then(function(payment) {
        req.user.getRegistration({include: [RegistrationInfo]})
        .then(addRegistrationPayment, payment)
        .then(function() {
          if(info.paid) {
            res.status(200).send('approved');
          } else {
            res.status(200).send('executed');
          }
      })
      .catch(function(err) {
        console.log('Error saving payment: ' + err);
        res.status(500).send('ERROR saving payment');
      })
    }
  });
});

function create_payment(req, res, next, currency, amount) {
  var create_payment = {
    'intent': 'sale',
    "experience_profile_id": config['registration']['paypal_experience_profile'],
    'payer': {
      'payment_method': 'paypal'
    },
    'redirect_urls': {
      'return_url': config['auth']['persona_audience'] + '/registration/pay/paypal/return',
      'cancel_url': config['auth']['persona_audience'] + '/registration/pay'
    },
    'transactions': [{
      'item_list': {
        'items': [{
          'name': config['registration']['payment_product_name'],
          'sku': config['registration']['payment_sku_prefix'] + 'regfee:' + req.user.email,
          'price': amount.toString(),
          'currency': currency,
          'quantity': 1
        }]
      },
      'amount': {
        'currency': currency,
        'total': amount.toString()
      },
      'description': config['registration']['payment_product_name'] + ' fee for ' + req.user.email
    }]
  };

  paypal.payment.create(create_payment, function(err, payment) {
    if(!!err) {
      console.log('ERROR: ');
      console.log(err);
      console.log(err['response']['details']);
      res.status(500).send('Error requesting payment authorization');
    } else {
      req.session.payment = {'request': create_payment, 'response': payment};
      for(var index = 0; index < payment.links.length; index++) {
        if(payment.links[index].rel == 'approval_url') {
          res.redirect(payment.links[index].href);
        }
      }
    }
  });
};

router.all('/pay/do', utils.require_user);
router.all('/pay/do', utils.require_permission('registration/pay'));
router.post('/pay/do', function(req, res, next) {
  var method = req.body.method;
  req.body.regfee = Math.abs(req.body.regfee);
  var regfee = config.registration.specific_amount || req.body.regfee;
  var currency = req.body.currency || config.registration.main_currency;
  if(regfee == 0 || regfee == null) {
    method = 'onsite';
  }
  if(method == 'onsite') {
    var info = {
      currency: currency,
      amount: regfee,
      paid: false,
      type: 'onsite',
    };
    RegistrationPayment
      .create(info)
      .catch(function(err) {
        console.log('Error saving payment: ' + err);
        res.status(500).send('ERROR saving payment');
      })
      .then(function(payment) {
        req.user.getRegistration({include: [RegistrationInfo]})
          .then(function(reg) {
            reg.addRegistrationPayment(payment)
              .catch(function(err) {
                console.log('Error attaching payment to reg: ' + err);
                res.status(500).send('Error attaching payment');
              })
              .then(function() {
                  res.render('registration/payment_onsite_registered', {currency: info.currency, amount: info.amount});
              });
          });
      });
  } else if(method == 'paypal') {
    req.session.regfee = regfee;
    req.session.currency = currency;
    create_payment(req, res, next, currency, regfee);
  } else {
    res.status(402).send('Invalid payment method selected');
  }
});

router.all('/receipt', utils.require_user);
router.all('/receipt', utils.require_permission('registration/request_receipt'));
router.get('/receipt', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, RegistrationInfo]})
  .catch(function(err) {
    res.status(500).send('Error retrieving your registration');
  })
  .then(function(reg) {
    if(reg == null || !reg.has_confirmed_payment) {
      res.status(401).send('We do not have any confirmed payments for this registration.');
    } else {
      res.render('registration/receipt', { registration: reg , layout:false });
    }
  });
});

router.all('/register', utils.require_permission('registration/register'));
router.get('/register', function(req, res, next) {
  // Show the registration form; used both for initial registration and
  // updating existing registration info.
  if(req.user) {
    req.user.getRegistration({include: [RegistrationPayment, RegistrationInfo]})
    .then(function(reg) {
      query_fields_left(reg, utils.get_reg_fields(null, reg, true))
      .then(function(reg_fields) {
        console.log(reg_fields);
        res.render('registration/register', { registration: reg,
                                              registration_fields: reg_fields,
                                              ask_regfee: reg == null,
                                              min_amount_main_currency: get_min_main() });
      });
    });
  } else {
    query_fields_left(null, utils.get_reg_fields(null, null, true))
    .then(function(reg_fields) {
      res.render('registration/register', { registration: {is_public: true}, ask_regfee: true,
                                            registration_fields: reg_fields,
                                            min_amount_main_currency: get_min_main()});
    });
  }
});

router.post('/register', function(req, res, next) {
  // Create or update a registration.
  if(!req.user) {
    // Create user object and set as req.user
    if(req.body.name === undefined) {
      req.body.name = '';
    }

    if(req.body.name.trim() == '') {
      query_fields_left(null, utils.get_reg_fields(req, null, true))
      .then(function(reg_fields) {
        var error = "No name was given";
        console.log("Submission error: " + error);
        res.render('registration/register', { registration: null, submission_error: error,
                                              ask_regfee: true, registration_fields: reg_fields,
                                              min_amount_main_currency: get_min_main()} );
      });
    } else {
      var user_info = {
        email: req.session.currentUser,
        name: req.body.name.trim()
      };
      User.create(user_info)
        .catch(function(err) {
          console.log("Error saving user object: " + err);
          res.status(500).send('Error saving user');
        })
        .then(function(user) {
          req.user = user;
          handle_registration(req, res, next);
        });
    }
  } else {
    return handle_registration(req, res, next);
  }
});

// Fills in an 'amount left' attribute for each registration field that has a
// configured limit. For example, a 'tshirt_size' field would have a limit on
// how many T-shirts of each size are available.
function query_fields_left(reg, field_values, keys, result) {
  if (result === undefined)
    result = {};

  if (keys === undefined)
    keys = Object.keys(field_values);

  return new Promise(function (resolve, reject) {

    while (keys.length > 0) {
      var fieldname = keys[0];
      var field = field_values[fieldname];
      result[fieldname] = field;

      if (field['type'] !== 'select' || field['limits'] === undefined) {
        delete keys.shift();
        continue;
      }

      if (field['left'] === undefined)
        field['left'] = [];

      for (var i = field['left'].length; i < field['limits'].length; i++) {
        var limit = field['limits'][i];
        if (limit < 0) {
          field['left'].push({option: field['options'][i], left: -1});
          continue;
        }

        var reg_where = {};
        if (reg) {
          reg_where = {
            /* Not this user. */
            'id' : {
              ne : reg.id
            }
          };
        }

        Registration.count(
          {
            include: [{
              model: RegistrationInfo,
              'where' : {
                'field' : fieldname,
                'value' : field['options'][i]
              }
            }],
            'where' : reg_where
          }
        ) .then(function(count) {
            var left = Math.max(0, limit - count);
            field['left'].push({option: field['options'][i], left: left});

            query_fields_left(reg, field_values, keys, result)
              .then(function (res) { resolve(res); });
          });

        return;
      }

      keys.shift();
      query_fields_left(reg, field_values, keys, result)
        .then(function (res) { resolve(res); });

      return;
    }

    resolve(result);
  });
}

// Check if registration submission is valid.
//
// Returns null if there is no error, or a string describing the problem
// if an error is found.
function check_field_values(req, reg, field_values) {
  for (var fieldname in field_values) {
    var field = field_values[fieldname];
    if (field['type'] == 'string') {
      if (field['required'] && field['value'].trim() == '')
        return "Required field '" + field['display_name'] + "' was not set";
    } else if (field['type'] == 'select') {
      if (field['required']) {
        /* Check whether the option exists. */
        if (field['options'].indexOf(field['value']) == -1) {
          return "Invalid choice '" + field['value'] + "' for field '" + field['display_name'] + "'";
        }
      }

      if (field['left'] !== undefined) {
        var idx = field['options'].indexOf(field['value']);
        if (idx == -1)
          return "Invalid choice '" + field['value'] + "' for field '" + field['display_name'] + "'";
        var left = field['left'][idx]['left'];
        if (left == 0)
          return "No more '" + field['value'] + "' purchases available for field " + field['display_name'];
      }
    }
  }
  return null;
}

function handle_registration(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, RegistrationInfo]})
  .then(function(reg) {
    query_fields_left(reg, utils.get_reg_fields(req, reg, true))
    .then(function (reg_fields) {
      if(req.body.is_public === undefined) {
        req.body.is_public = 'false';
      }

      if (reg) {
        var currency = reg.currency;
        var regfee = reg.regfee;
      } else {
        var currency = req.body.currency;
        var regfee = config.registration.specific_amount || req.body.regfee;
      };

      var reg_info = {
        is_public: req.body.is_public.indexOf('false') == -1,
        badge_printed: false,
        receipt_sent: false,
        regfee: regfee,
        currency: currency,
        UserId: req.user.Id
      };
      reg_info.UserId = req.user.Id;

      var can_pay = utils.get_permission_checker("registration/pay")(req.session.currentUser);

      var error = null;
      if(reg == null && (regfee == null || regfee <= 0) && can_pay) {
        error = "Please choose a registration fee";
      } else if (reg == null && config.registration.currencies[currency] == undefined && can_pay) {
        error = "Please choose a valid currency";
      } else {
        error = check_field_values(req, reg, reg_fields);
      }

      if (error != null) {
        console.log("Bad submission: " + error);
        res.render('registration/register', { registration: reg_info,
                                              registration_fields: reg_fields,
                                              submission_error: error, ask_regfee: reg == null,
                                              min_amount_main_currency: get_min_main()});
      } else {
        // Form OK
        var is_new_registration = (reg == null);
        if(is_new_registration) {
          // Create new registration
          var reg_promise = Registration.create(reg_info)
            .then(function(reg) {
              req.user.setRegistration(reg)
              return reg;
          });
        } else {
          // Update
          reg.is_public = reg_info.is_public;
          var reg_promise = reg.save()
        }

        reg_promise
          .then(function(reg) {
            return update_field_values(req, res, next, reg, reg_fields);
          })
          .then(function() {
            var template, email_template;
            if(is_new_registration) {
              template = "registration/registration_success";
              email_template = "registration/registered";
            } else {
              template = "registration/update_success";
              email_template = "registration/updated";
            }

            utils.send_email(req, res, null, email_template, {
              registration: reg,
              reg_fields: reg_fields,
            }, function() {
              res.render(template, {currency: currency, regfee: regfee,
                                   needpay: can_pay && regfee != '0'});
            });
          })
          .catch(function(err) {
            console.log('Error in handle_registration: ' + err);
            res.status(500).send('Error updating your registration');
          });
      }
    });
  });
};

// Create or update stored registration info
function update_field_values(req, res, next, reg, fields) {
  var update_promises = Object.keys(fields)
    .filter(function(field) { return fields[field].type != 'documentation' })
    .map(function(field_name) {
      var field = fields[field_name];

      // Look for existing record to update
      for(var info in reg.RegistrationInfos) {
        info = reg.RegistrationInfos[info];
        if(info.field == field_name) {
          info.value = field.value;
          return info.save()
        }
      }

      // If not found, create a new one
      var info = {
        RegistrationId: reg.id,
        field: field_name,
        value: field.value
      };

      return RegistrationInfo.create(info)
    });

  return Promise.all(update_promises)
    .catch(function(err) {
      console.log('Error saving reg: ' + err);
      res.status(500).send('Error saving registration info');
      return null;
    });
};

module.exports = router;
