var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;
var RegistrationInfo = models.RegistrationInfo;

var countries = require('country-data').countries;

var config = require('../configuration');

var paypal = require('paypal-rest-sdk');
paypal.configure(config['paypal']);

function get_min_main() {
  // Get the minimum amount for receipt in local currency
  var main_currency = config['registration']['main_currency'];
  return config['registration']['currencies'][main_currency]['min_amount_for_receipt'];
}


function get_reg_fields(request, registration) {
  var fields = {};
  for(var field in config['registration']['fields']) {
    fields[field] = config['registration']['fields'][field];
    if(fields[field]['type'] == 'country') {
      fields[field]['type'] = 'select';
      var options = [];
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

router.all('/', utils.require_feature("registration"));

function show_list(req, res, next, show_private) {
  var filter = {};
  if(!show_private) {
    filter = { is_public: true };
  }
  Registration
    .findAll({
      where: filter,
      include: [User, RegistrationInfo]
    })
    .then(function(registrations) {
      var field_ids = [null];
      var field_display_names = ['Name'];
      var fields = config['registration']['fields'];
      for(var field in fields) {
        if(show_private || !fields[field]['private']) {
          field_ids.push(field);
          field_display_names.push(fields[field]['short_display_name']);
        }
      }
      var display_regs = [];
      for(var registration in registrations) {
        registration = registrations[registration];
        var cur_reg = [];
        cur_reg.push(registration['User'].name);
        var field_values = get_reg_fields(null, registration);
        for(var field in field_ids) {
          field = field_ids[field];
          if(field != null) {
            cur_reg.push(field_values[field].value);
          }
        }
        display_regs.push(cur_reg);
      }
      res.render('registration/list', { fields: field_display_names, registrations: display_regs });
    });
};

router.all('/list', utils.require_permission('registration/view_public'));
router.get('/list', function(req, res, next) {
  return show_list(req, res, next, false);
});

router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('registration/view_all'));
router.get('/admin/list', function(req, res, next) {
  return show_list(req, res, next, true);
});

router.all('/pay', utils.require_user);
router.all('/pay', utils.require_permission('registration/pay'));
router.get('/pay', function(req, res, next) {
  res.render('registration/pay');
});

router.post('/pay', function(req, res, next) {
  var currency = req.body.currency;
  var regfee = config.registration.specific_amount || req.body.regfee;
  
  if(regfee == null) {
    res.render('registration/pay');
  } else {
    res.render('registration/pay_do', {currency: currency, regfee: regfee.trim()});
  }
});

router.all('/pay/paypal/return', utils.require_user);
router.all('/pay/paypal/return', utils.require_permission('registration/pay'));
router.get('/pay/paypal/return', function(req, res, next) {
  res.render('registration/pay_paypal', {regfee: req.session.regfee, payerId: req.query.PayerID, paymentId: req.query.paymentId});
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
                  res.status(500).send('error');
                })
                .then(function() {
                  if(info.paid) {
                    res.status(200).send('approved');
                  } else {
                    res.status(200).send('executed');
                  }
                });
            });
        });
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
      'return_url': config['persona_audience'] + '/registration/pay/paypal/return',
      'cancel_url': config['persona_audience'] + '/registration/pay'
    },
    'transactions': [{
      'item_list': {
        'items': [{
          'name': config['registration']['payment_product_name'],
          'sku': 'regfee:' + req.user.email,
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
  if(regfee == 0 || regfee == null) {
    method = 'onsite';
  }
  if(method == 'onsite') {
    var info = {
      currency: req.body.currency,
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
    create_payment(req, res, next, req.body.currency, regfee);
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
    if(!reg.eligible_for_receipt) {
      res.status(401).send('Not enough paid for receipt');
    } else {
      res.render('registration/receipt', { registration: reg , layout:false });
    }
  });
});

router.all('/register', utils.require_permission('registration/register'));
router.get('/register', function(req, res, next) {
  if(req.user){
    req.user.getRegistration({include: [RegistrationInfo]})
    .then(function(reg) {
      res.render('registration/register', { registration: reg,
                                            registration_fields: get_reg_fields(null, reg),
                                            ask_regfee: reg == null,
                                            min_amount_main_currency: get_min_main() });
    });
  } else {
    res.render('registration/register', { registration: {is_public: true}, ask_regfee: true,
                                          registration_fields: get_reg_fields(null, null),
                                          min_amount_main_currency: get_min_main()});
  };
});

router.post('/register', function(req, res, next) {
  if(!req.user) {
    // Create user object and set as req.user
    if(req.body.name === undefined) {
      req.body.name = '';
    }

    if(req.body.name.trim() == '') {
      res.render('registration/register', { registration: null, submission_error: true, ask_regfee: true,
                                            registration_fields: get_reg_fields(req, null),
                                            min_amount_main_currency: get_min_main()} );
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

function handle_registration(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, RegistrationInfo]})
  .then(function(reg) {
    if(req.body.is_public === undefined) {
      req.body.is_public = 'false';
    }

    var reg_info = {
      is_public: req.body.is_public.indexOf('false') == -1,
      badge_printed: false,
      receipt_sent: false,
      UserId: req.user.Id
    };
    var currency = req.body.currency;
    var regfee = config.registration.specific_amount || req.body.regfee;
    reg_info.UserId = req.user.Id;

    var can_pay = utils.get_permission_checker("registration/pay")(req.session.currentUser);

    if(reg == null && regfee == null && can_pay) {
      res.render('registration/register', { registration: reg_info,
                                            registration_fields: get_reg_fields(req, reg),
                                            submission_error: true, ask_regfee: reg == null,
                                            min_amount_main_currency: get_min_main()});
    } else {
      // Form OK
      if(reg == null) {
        // Create new registration
        Registration.create(reg_info)
          .catch(function(err) {
            console.log('Error saving reg: ' + err);
            res.status(500).send('Error saving registration');
          })
          .then(function(reg) {
            req.user.setRegistration(reg)
              .catch(function(err) {
                console.log('Error adding reg to user: ' + err);
                res.status(500).send('Error attaching registration to your user');
              })
              .then(function() {
                var field_values = get_reg_fields(req, null);
                return update_field_values(req, res, next,
                                           false,
                                           reg, get_reg_fields(req, null),
                                           currency, regfee, can_pay, get_reg_fields(req, null));
            });
        });
      } else {
        // Update
        reg.is_public = reg_info.is_public;
        reg.save()
          .catch(function(err) {
            res.render('registration/register', { registration: reg_info,
                                                  registration_fields: get_reg_fields(req, reg),
                                                  save_error: true,
                                                  min_amount_main_currency: get_min_main() });
          })
          .then(function (reg){
            return update_field_values(req, res, next, true, reg,
                                       get_reg_fields(req, reg), null, null, null, get_reg_fields(req, reg));
        });
      }
    }
  });
};

function update_field_values(req, res, next, is_update, reg, field_values, currency, regfee, canpay, allfields) {
  var template, email_template, subject;
  if(is_update) {
    template = "registration/update_success";
    email_template = "registration/updated";
  } else {
    template = "registration/registration_success";
    email_template = "registration/registered";
  }
  var keys = Object.keys(field_values);
  if(keys.length == 0) {
    utils.send_email(req, res, null, email_template, {
      registration: reg,
      reg_fields: allfields
    }, function() {
      return res.render(template, {currency: currency, regfee: regfee,
                                   needpay: canpay && regfee != '0'});
    });
    return;
  }

  var first = keys[0];
  var current = field_values[first];
  delete field_values[first];

  var updated = false;
  for(var info in reg.RegistrationInfos) {
    info = reg.RegistrationInfos[info];
    if(!updated && info.field == first) {
      // Update this one
      updated = true;
      info.value = current.value;
      info.save()
        .catch(function(err) {
          console.log('Error saving reg: ' + err);
          res.status(500).send('Error saving registration info');
          return null;
        })
        .then(function(err, info) {
          return update_field_values(req, res, next, is_update, reg, field_values, currency, regfee, canpay, allfields);
      });
    }
  }
  if(!updated) {
    // We did not store this info before, create new object
    var info = {
      RegistrationId: reg.id,
      field: first,
      value: current.value
    };

    RegistrationInfo.create(info)
      .catch(function(err) {
        console.log('Error saving reg: ' + err);
        res.status(500).send('Error saving registration info');
      })
      .then(function() {
        return update_field_values(req, res, next, is_update, reg, field_values, currency, regfee, canpay, allfields);
      });
  }
};

module.exports = router;
