var express = require('express');
var router = express.Router();
var Promise = require("bluebird");

var utils = require('../utils');
var regutils = require('./registration_utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;
var RegistrationInfo = models.RegistrationInfo;

var xlsx = require('xlsx');

var config = require('../configuration');

function get_min_main() {
  // Get the minimum amount for receipt in local currency
  var main_currency = config['registration']['main_currency'];
  return config['registration']['currencies'][main_currency]['min_amount_for_receipt'];
}

var paypal = require('paypal-rest-sdk');
paypal.configure(config['registration']['paypal']['api_credentials']);

// Show all registrations.
//
// This function is used both for the public list (which shows the names only)
// and admin views (which show all info not marked aggregate-only).
const show_list = function(req, res, next, show_private, show_payment, csv, cb) {
  var filter = {};
  var include = {};
  if(!show_private) {
    filter = { is_public: true };
  }
  if (show_payment) {
    include = [User, RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]
  } else {
    include = [User, RegistrationInfo];
  }
  Registration
    .findAll({
      where: filter,
      include: include,
      order: [['id']]
    })
    .then(function(registrations) {
      var field_ids = [null];
      var field_display_names = [];
      var fields = config['registration']['fields'];

      if (show_private) {
        field_display_names.push("UserID");
      }
      field_display_names.push("Name");
      if (show_private) {
        field_display_names.push('Mail')
      }

      for(var field in fields) {
        if (fields[field]['type'] == 'documentation')
          continue;
        if (fields[field]['type'] == 'legend')
          continue;
        if (fields[field]['aggregate_only'])
          continue;
        if(show_private || (!fields[field]['private'] && !fields[field]['internal'])) {
          field_ids.push(field);
          if(csv) {
            field_display_names.push(field);
          } else {
            field_display_names.push(fields[field]['short_display_name']);
          }
        }
      }

      if(show_payment) {
        field_display_names.push('Paid');
        field_display_names.push('Regfee');
        field_display_names.push('PaypalTxId');
        //field_display_names.push('Unpaid');
      }

      var display_regs = registrations.map(function(registration) {
        return {"id": registration.id,
                "info": regutils.show_registration(registration, field_ids,
                  show_private, show_payment)
          };
      })
      var data = {
        fields: field_display_names,
        registrations: display_regs};
      if(cb == undefined) {
        res.render('registration/list', data);
      } else {
        cb(res, data);
      }
    });
};

router.all('/', utils.require_feature("registration"));

router.get('/', function(req, res, next) { res.redirect('/') });

router.all('/list', utils.require_permission('registration/view_public'));
router.get('/list', function(req, res, next) {
  return show_list(req, res, next, false, false);
});

router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('registration/view_all'));
router.get('/admin/list', function(req, res, next) {
  var show_payment = utils.get_permission_checker('registration/view_payment')(req.session.currentUser);
  return show_list(req, res, next, true, show_payment, false);
});

router.all('/admin/list/export', utils.require_user);
router.all('/admin/list/export', utils.require_permission('registration/view_all'));
router.get('/admin/list/export', function(req, res, next) {
  var show_payment = utils.get_permission_checker('registration/view_payment')(req.session.currentUser);
  regs = show_list(req, res, next, true, show_payment, true, function(res, regs) {
    var data = [];
    data.push(regs.fields);
    for(var i in regs.registrations) {
      var reg = regs.registrations[i];
      data.push(reg.info);
    }
    var sheet = xlsx.utils.aoa_to_sheet(data);
    var wb = { SheetNames: ["Registrations"], Sheets: {"Registrations": sheet}};

    res.attachment("registrations.xlsx");
    res.send(xlsx.write(wb, {bookType: 'xlsx', bootSST: true, type: 'buffer'}));
  });
});

router.all('/admin/cancel', utils.require_user);
router.all('/admin/cancel', utils.require_permission('registration/cancel_all'));
router.post('/admin/cancel', function(req, res, next) {
  var regid = req.body.regid;
  Registration.findOne({where: {id: regid}})
  .then(function(reg) {
    if (!reg) {
      res.status(404).send('Registration not found.');
    } else {
      reg.destroy();
      res.redirect('/registration/admin/list');
    }
  });
});


router.all('/pay', utils.require_user);
router.all('/pay', utils.require_permission('registration/pay'));
router.get('/pay', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]}).then(function(reg) {
    var can_pay = utils.get_permission_checker("registration/pay")(req.session.currentUser);

    if (reg == null || !can_pay)
      res.redirect('/');
    else {
      var new_purchase_choices = regutils.get_reg_purchase_choices_unpaid(reg, regutils.get_reg_fields(null, reg, true), reg.currency);
      var needpay = !reg.paid || new_purchase_choices.length > 0;
      var donation = regutils.get_reg_fields(null, reg, false)['sponsor_additional_amount']['value'];
      if(isNaN(parseFloat(donation)) || parseFloat(donation) < 0) { donation = "0" };

      res.render('registration/pay', { registration: reg, needpay: needpay,
                                       currency: reg.currency, regfee: reg.regfee,
                                       regfee_paid: reg.paid.length > 0,
                                       donation: donation, total_topay: parseFloat(reg.regfee)+parseFloat(donation),
                                       new_purchase_choices: new_purchase_choices });
    }
  });
});

router.post('/pay', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]}).then(function(reg) {
    var donation = regutils.get_reg_fields(null, reg, false)['sponsor_additional_amount']['value'];
    if(isNaN(parseFloat(donation)) || parseFloat(donation) < 0) { donation = "0" };
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
  if (req.session.to_pay == undefined || req.session.currency == undefined) {
    // We somehow lost the session state; best to restart the payment sequence.
    res.redirect('/registration/pay');
  } else {
    res.render('registration/pay_paypal', {currency: req.session.currency, to_pay: req.session.to_pay.toFixed(2), payerId: req.query.PayerID, paymentId: req.query.paymentId});
  }
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
  paypal.payment.execute(paymentID, execute_payment, function(err, paypal_payment) {
    if(!!err) {
      console.log('ERROR');
      console.log(JSON.stringify(err));
      res.status(500).send('authorization-failure');
    } else {
      console.log('Response: ');
      console.log(JSON.stringify(paypal_payment));

      var paypal_transaction = paypal_payment.transactions[0];
      var info = {
        currency: paypal_transaction['amount']['currency'],
        amount: paypal_transaction['amount']['total'],
        paid: paypal_payment.state == 'approved',
        type: 'paypal',
        details: paypal_payment.id
      };
      console.log('Storing');
      console.log(info);

      RegistrationPayment.create(info)
      .then(function(reg_payment) {
        req.user.getRegistration({include: [RegistrationInfo]})
        .then(function(reg) {
          return reg.addRegistrationPayment(reg_payment);
        })
        .then(function(reg) {
          return Promise.all(
            paypal_transaction.item_list.items.map(function(item) {
              var sku_parts = item.sku.split(':');
              var field_name = sku_parts[1];
              var option_name = sku_parts[2];
              if (field_name == 'regfee')
                return Promise.resolve();
              else
                return reg.associate_payment_with_purchase(
                    reg_payment, field_name, option_name);
            }))
        })
        .then(function() {
          if(info.paid) {
            res.status(200).send('approved');
          } else {
            res.status(200).send('executed');
          }
        })
      })
      .catch(function(err) {
        console.log('Error saving payment: ' + err);
        res.status(500).send('ERROR saving payment');
      })
    }
  });
});

function create_paypal_payment_and_redirect(req, res, next, currency, regfee, purchase_choices, donation) {
  var items = [];

  var total = 0.0;

  if (regfee > 0) {
    total += parseFloat(regfee);
    items.push({
      'name': config['registration']['payment_product_name'],
      'sku': 'regfee:' + req.user.email,
      'price': regfee.toString(),
      'currency': currency,
      'quantity': 1
    });
  }

  /*purchase_choices.forEach(function(choice) {
    total += choice.cost;
    items.push({
      'name': choice.field_display_name + " (" + choice.option_display_name + ")",
      'sku': regutils.make_paypal_sku_for_purchase(choice.field_name, choice.option_name),
      'price': choice.cost.toString(),
      'currency': currency,
      'quantity': 1
    })
  });*/

  if (donation > 0) {
    total += parseFloat(donation);
    items.push({
      'name': "Donation",
      'sku': 'donation:' + req.user.email,
      'price': donation.toString(),
      'currency': currency,
      'quantity': 1
    });
  }
  console.log(typeof total);

  var create_payment = {
    'intent': 'sale',
    "experience_profile_id": config['registration']['paypal_experience_profile'],
    'payer': {
      'payment_method': 'paypal'
    },
    'redirect_urls': {
      'return_url': config['site_url'] + '/registration/pay/paypal/return',
      'cancel_url': config['site_url'] + '/registration/pay'
    },
    'transactions': [{
      'item_list': {
        'items': items
      },
      'amount': {
        'currency': currency,
        'total': total.toFixed(2),
      },
      'description': config['registration']['payment_product_name'] + ' for ' + req.user.email
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

function create_or_update_onsite_payment(reg, currency, amount) {
  return reg.getRegistrationPayments({where: {type: 'onsite'}})
  .then(function(onsite_payments) {
    if (onsite_payments.length == 0) {
      // Create a new payment
      var info = {
        currency: currency,
        amount: amount,
        paid: false,
        type: 'onsite',
      };
      console.log("Creating a payment: %j", info);
      return RegistrationPayment
      .create(info)
      .then(function(payment) {
        return reg.addRegistrationPayment(payment)
      });
    } else {
      if (onsite_payments.length > 1)
        console.warn("User id %s has multiple onsite payments!", reg.UserId);
      if (onsite_payments[0].paid)
        console.warn("Refusing to update onsite payment that was already " +
            "paid for user id %s.", reg.UserId)
      onsite_payments[0].currency = currency;
      onsite_payments[0].amount = amount;
      return onsite_payments[0].save();
    };
  });
};

// Receiving payment requests.
//
// The logic here is a bit complicated because we allow deferring some payments
// for on-site payment, but we don't allow deferring others.
router.all('/pay/do', utils.require_user);
router.all('/pay/do', utils.require_permission('registration/pay'));
router.post('/pay/do', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
  .catch(function(err) {
    res.status(500).send('Error retrieving your registration');
  })
  .then(function(reg) {
    var currency = req.body.currency || reg.currency;
    var regfee = 0;
    var donation = 0;

    if (!reg.paid) {
      regfee = reg.regfee;
    };

    var donation = regutils.get_reg_fields(null, reg, false)['sponsor_additional_amount']['value'];
    if(isNaN(parseFloat(donation)) || parseFloat(donation) < 0) { donation = "0" };

    var to_pay_paypal = 0;
    var to_pay_onsite = 0;

    if (req.body['regfee-method'] == 'onsite') {
      to_pay_onsite += parseFloat(regfee);
      to_pay_onsite += parseFloat(regfee);
    } else {
      to_pay_paypal += parseFloat(regfee);
      to_pay_paypal += parseFloat(donation);
    }

    var promises = [];
    if (to_pay_onsite > 0) {
      promises.push(create_or_update_onsite_payment(reg, currency, to_pay_onsite));
      regfee = 0;
    }

    Promise.all(promises).then(function() {
      if (to_pay_paypal > 0) {
        req.session.currency = currency;
        req.session.to_pay = to_pay_paypal;
        create_paypal_payment_and_redirect(req, res, next, currency, regfee, 0.0, donation);
      } else {
        res.render('registration/payment_onsite_registered', {currency: currency, amount: to_pay_onsite});
      }
    });
  })
});

router.all('/receipt', utils.require_user);
router.all('/receipt', utils.require_permission('registration/request_receipt'));
router.get('/receipt', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
  .catch(function(err) {
    res.status(500).send('Error retrieving your registration');
  })
  .then(function(reg) {
    if(reg == null || !reg.has_confirmed_payment) {
      res.status(401).send('We do not have any confirmed payments for this registration.');
    } else {
      var paid_purchase_choices = regutils.get_reg_purchase_choices_paid(reg, regutils.get_reg_fields(null, reg, true), reg.currency);
      res.render('registration/receipt', { registration: reg,
                                           paid_purchase_choices: paid_purchase_choices,
                                           layout: false });
    }
  });
});

router.all('/cancel', utils.require_user);
router.all('/cancel', utils.require_permission('registration/cancel'));
router.get('/cancel', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo }]})
  .catch(function(err) {
    res.status(500).send('Error retrieving your registration');
  })
  .then(function(reg) {
    if(reg == null) {
      res.status(401).send('You are not currently registered.');
    } else {
      res.render('registration/cancel_confirm', { registration: reg});
    }
  });
});

router.post('/cancel', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo }]})
  .catch(function(err) {
    res.status(500).send('Error retrieving your registration');
  })
  .then(function(reg) {
    if(reg == null) {
      res.status(401).send('You are not currently registered.');
    } else {
      reg.destroy();
      utils.send_email(req, res, null, "registration/cancelled", {
      }, function() {
        res.render('registration/cancelled');
      });
    }
  });
});

router.all('/register', utils.require_permission('registration/register'));
router.get('/register', function(req, res, next) {
  // Show the registration form; used both for initial registration and
  // updating existing registration info.
  if(req.user) {
    req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
    .then(function(reg) {
      regutils.query_inventory(reg, regutils.get_reg_fields(null, reg, true))
      .then(function(reg_fields) {
        var regfee = config.registration.default_amount;
        if (reg) regfee = reg['regfee'];
        console.log(reg_fields);
        res.render('registration/register', { registration: reg,
                                              registration_fields: reg_fields,
                                              regfee: regfee,
                                              min_amount_main_currency: get_min_main(),
                                              already_registered: reg != null,
                                              req: req});
      });
    });
  } else {
    regutils.query_inventory(null, regutils.get_reg_fields(null, null, true))
    .then(function(reg_fields) {
      res.render('registration/register', { registration: {is_public: true},
                                            registration_fields: reg_fields,
                                            regfee: config.registration.default_amount,
                                            min_amount_main_currency: get_min_main(),
                                            already_registered: false,
                                            req: req });
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
      regutils.query_inventory(null, regutils.get_reg_fields(req, null, true))
      .then(function(reg_fields) {
        var error = "No name was given";
        console.log("Submission error: " + error);
        res.render('registration/register', { registration: null, submission_error: error,
                                              registration_fields: reg_fields,
                                              min_amount_main_currency: get_min_main(),
                                              req: req} );
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

function handle_registration(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
  .then(function(reg) {
    regutils.query_inventory(reg, regutils.get_reg_fields(req, reg, true))
    .then(function (reg_fields) {
      if(req.body.is_public === undefined) {
        req.body.is_public = 'false';
      }

      var currency = req.body.currency;
      var regfee = req.body.regfee;
      var donation = req.body.field_sponsor_additional_amount;
      if(isNaN(parseFloat(donation)) || parseFloat(donation) < 0) { donation = "0" };

      if (reg && currency==undefined) { currency = reg.currency; };
      if (reg && regfee==undefined) { regfee = reg.regfee; };
      console.log('Donation: ' + donation);

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
      if((regfee == null || regfee < 0) && can_pay) {
        error = "Please choose a valid registration fee";
      } else if (config.registration.currencies[currency] == undefined && can_pay) {
        error = "Please choose a valid currency";
      } else if(reg != null && regfee != reg.regfee && reg.paid) {
        regfee = reg.regfee;
      } else if(reg != null && currency != reg.currency && reg.paid) {
        currency = reg.currency;
        error = "You cannot change your preferred currency because you have already paid.";
      } else {
        error = regutils.check_field_values(reg, reg_fields);
      }

      if (error != null) {
        console.log("Bad submission: " + error);
        res.render('registration/register', { registration: reg_info,
                                              registration_fields: reg_fields,
                                              regfee: regfee,
                                              submission_error: error,
                                              min_amount_main_currency: get_min_main(),
                                              req: req});
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
          reg.regfee = regfee;
          reg.currency = currency;
          var reg_promise = reg.save()
        }

        reg_promise
        .then(function(reg) {
          update_field_values(req, res, next, reg, reg_fields)
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
              var new_purchase_choices = regutils.get_reg_purchase_choices_unpaid(reg, reg_fields, currency);
              var needpay = !reg.paid || new_purchase_choices.length > 0;

              if (needpay && !can_pay) {
                console.warn("User " + req.user.id + " needs to pay but lacks permission");
              }
              if(isNaN(parseFloat(donation)) || parseFloat(donation) < 0) { donation = "0" };

              if (!reg.paid && regfee == 0) {

                // If there's no registration fee, we'll need to create/update
                // an onsite RegistrationPayment object in case there already
                // was one.
                create_or_update_onsite_payment(reg, currency, 0);
                needpay = false;
              }

              res.render(template, {currency: currency, regfee: regfee,
                                    regfee_paid: reg.paid.length > 0,
                                    donation: donation, total_topay: parseFloat(regfee)+parseFloat(donation),
                                    needpay: can_pay && needpay});
            })
          })
          .catch(function(err) {
            console.log('Error in handle_registration: ' + err);
            res.status(500).send('Error updating your registration');
          });
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
