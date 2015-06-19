var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;

var env       = process.env.NODE_ENV || "development";
var config = require('../config/config.json')[env];

var paypal = require('paypal-rest-sdk');
paypal.configure(config['paypal']);

router.all('/', utils.require_feature("registration"));

router.all('/list', utils.require_permission('registration/view_public'));
router.get('/list', function(req, res, next) {
  Registration
    .findAll({
      where: {
        is_public: true
      }
    })
    .complete(function(err, registrations) {
      res.render('registration/list', { registrations: registrations });
    });
});

router.all('/pay', utils.require_user);
router.all('/pay', utils.require_permission('registration/pay_extra'));
router.get('/pay', function(req, res, next) {
  res.render('registration/pay');
});

router.post('/pay', function(req, res, next) {
  var regfee = req.body.regfee.trim();
  
  if(regfee == null) {
    res.render('registration/pay');
  } else {
    res.render('registration/pay_do', {regfee: regfee});
  }
});

router.all('/pay/paypal/return', utils.require_user);
router.all('/pay/paypal/return', utils.require_permission('registration/pay_extra'));
router.get('/pay/paypal/return', function(req, res, next) {
  res.render('registration/pay_paypal', {regfee: req.session.regfee, payerId: req.query.PayerID, paymentId: req.query.paymentId});
});

router.all('/pay/paypal/execute', utils.require_user);
router.all('/pay/paypal/execute', utils.require_permission('registration/pay_extra'));
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
  paypal.payment.execute(paymentID, execute_payment, function(error, payment) {
    if(!!error) {
      console.log('ERROR');
      console.log(JSON.stringify(error));
      res.status(500).send('authorization-failure');
    } else {
      console.log('Response: ');
      console.log(JSON.stringify(payment));
      var info = {
        amount: payment.transactions[0]['amount']['total'],
        paid: payment.state == 'approved',
        type: 'paypal',
        details: payment.id
      };
      console.log('Storing');
      console.log(info);
      RegistrationPayment
        .create(info)
        .complete(function(err, payment) {
          if(!!err) {
            console.log('Error saving payment: ' + err);
            res.status(500).send('ERROR saving payment');
          } else {
            req.user.getRegistration()
              .complete(function(err, reg) {
                reg.addRegistrationPayment(payment)
                  .complete(function(err) {
                    if(!!err) {
                      console.log('Error attaching payment to reg: ' + err);
                      res.status(500).send('error');
                    } else {
                      if(info.paid) {
                        res.status(200).send('approved');
                      } else {
                        res.status(200).send('executed');
                      }
                    }
                  });
              });
          }
        });
    }
  });
});

function create_payment(req, res, next, amount) {
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
          'name': 'GUADEC Registration',
          'sku': 'regfee',
          'price': amount.toString(),
          'currency': config['registration']['currency_value'],
          'quantity': 1
        }]
      },
      'amount': {
        'currency': config['registration']['currency_value'],
        'total': amount.toString()
      },
      'description': 'GUADEC Registration fee'
    }]
  };

  console.log('*************STARTING PAYMENT***********');
  console.log('************REQUEST***********');
  console.log(create_payment);
  paypal.payment.create(create_payment, function(error, payment) {
    console.log('***********RESPONSE********');
    if(!!error) {
      console.log('ERROR: ');
      console.log(error);
      console.log(error['response']['details']);
      res.error(500).send('Error requesting payment authorization');
    } else {
      console.log(payment);
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
router.all('/pay/do', utils.require_permission('registration/pay_extra'));
router.post('/pay/do', function(req, res, next) {
  var method = req.body.method;
  if(method == 'onsite') {
    var info = {
      amount: req.body.regfee,
      paid: false,
      type: 'onsite',
    };
    RegistrationPayment
      .create(info)
      .complete(function(err, payment) {
        if(!!err) {
          console.log('Error saving payment: ' + err);
          res.status(500).send('ERROR saving payment');
        } else {
          req.user.getRegistration()
            .complete(function(err, reg) {
              reg.addRegistrationPayment(payment)
                .complete(function(err) {
                  if(!!err) {
                    console.log('Error attaching payment to reg: ' + err);
                    res.status(500).send('Error attaching payment');
                  } else {
                    res.render('registration/payment_onsite_registered', {amount: info.amount});
                  }
                });
            });
        }
      });
  } else if(method == 'paypal') {
    req.session.regfee = req.body.regfee;
    create_payment(req, res, next, req.body.regfee);
  } else {
    res.status(402).send('Invalid payment method selected');
  }
});

router.all('/register', utils.require_permission('registration/register'));
router.get('/register', function(req, res, next) {
  if(req.user){
    req.user.getRegistration()
    .complete(function(err, reg) {
      res.render('registration/register', { registration: reg,
                                            ask_regfee: reg == null});
    });
  } else {
    res.render('registration/register', { registration: null, ask_regfee: true });
  };
});

router.post('/register', function(req, res, next) {
  if(!req.user) {
    // Create user object and set as req.user
    if(req.body.name.trim() == '') {
      res.render('registration/register', { registration: null, submission_error: true, ask_regfee: true} );
    } else {
      var user_info = {
        email: req.session.currentUser,
        name: req.body.name.trim()
      };
      User.create(user_info)
        .complete(function(err, user) {
          if(!!err) {
            console.log("Error saving user object: " + err);
            res.status(500).send('Error saving user');
          } else {
            req.user = user;
            handle_registration(req, res, next);
          };
        });
    }
  } else {
    return handle_registration(req, res, next);
  }
});

function handle_registration(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment]})
  .complete(function(err, reg) {
    var reg_info = {
      irc: req.body.irc.trim(),
      country: req.body.country.trim(),
      is_public: req.body.is_public.indexOf('true') != -1,
      badge_printed: false,
      receipt_sent: false,
      UserId: req.user.Id
    };
    var regfee = req.body.regfee;
    reg_info.UserId = req.user.Id;

    if((reg == null && regfee == null)) {
      res.render('registration/register', { registration: reg_info,
                                            submission_error: true, ask_regfee: reg == null});
    } else {
      // Form OK
      if(reg == null) {
        // Create new registration
        Registration.create(reg_info)
          .complete(function(err, reg) {
            if(!!err) {
              console.log('Error saving reg: ' + err);
              res.status(500).send('Error saving registration');
            } else {
              req.user.setRegistration(reg)
                .complete(function(err) {
                  if(!!err) {
                    console.log('Error adding reg to user: ' + err);
                    res.status(500).send('Error attaching registration to your user');
                  } else {
                    res.render('registration/registration_success', {regfee: regfee});
                  }
              });
            }
        });
      } else {
        // Update
        reg.irc = reg_info.irc;
        reg.country = reg_info.country;
        reg.is_public = reg_info.is_public;
        reg.save().complete(function (err, reg){
          if(!!err) {
            res.render('registration/register', { registration: reg_info,
                                                  save_error: true });
          } else {
            res.render('registration/update_success');
          }
        });
      }
    }
  });
};


router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('registration/view_all'));
router.get('/admin/list', function(req, res, next) {
  next();
});

module.exports = router;
