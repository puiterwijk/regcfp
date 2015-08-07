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

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var stream = require('stream');
var mktemp = require('mktemp');
var fs = require('fs');
var os = require('os');


router.all('/', utils.require_user);
router.all('/', utils.require_permission('registration/desk'));
router.get('/', function(req, res, next) {
  printed = null;
  message = null;
  if(req.query.new_id) {
    message = "Registration " + req.query.new_id + " was added";
  }
  else if(req.query.paid) {
    message = "Registration " + req.query.paid + " was marked as paid";
  }
  else if(req.query.cleared) {
    message = "Payments for " + req.query.cleared + " were cleared";
  }
  else if(req.query.added) {
    message = "Payment of " + req.query.amount + " registered for " + req.query.added;
  }
  else if(req.query.printed) {
    message = "Registration " + req.query.printed + " was finished!";
    if(!req.query.previous) {
      message += " Please finish a second one to print badges!";
      printed = req.query.printed;
    }
  }

  Registration
    .findAll({
      include: [User, RegistrationPayment]
    })
    .complete(function(err, registrations) {
      res.render('desk/main', { registrations: registrations, message: message, printed: printed });
    });
});

router.all('/add', utils.require_user);
router.all('/add', utils.require_permission('registration/desk'));
router.get('/add', function(req, res, next) {
  res.render('desk/add');
});

router.post('/add', function(req, res, next) {
  var user_info = {
    email: req.body.email.trim(),
    name: req.body.name.trim()
  };
  User
    .create(user_info)
    .complete(function(err, new_user) {
      if(!!err) {
        res.status(500).send("Error saving user: " + err);
      } else {
        var reg_info = {
          irc: req.body.irc.trim(),
          gender: req.body.gender.trim(),
          country: req.body.country.trim(),
          is_public: req.body.is_public.indexOf('false') == -1,
          badge_printed: false,
          receipt_sent: false,
          UserId: new_user.id
        };
        Registration.create(reg_info)
          .complete(function(err, reg) {
            if(!!err) {
              res.status(500).send('Error saving reg: ' + err);
            } else {
              res.render('desk/added', { regid: reg.id });
            }
          });
      }
    });
});

router.all('/receipt', utils.require_user);
router.all('/receipt', utils.require_permission('registration/desk'));
router.get('/receipt', function(req, res, next) {
  var regid = req.query.regid;
  Registration.findOne({where: {id:regid}, include: [User, RegistrationPayment]})
    .then(function(registration) {
      if(registration.paid < config.registration.min_amount_for_receipt) {
        res.status(401).send('Not enough paid for receipt');
      } else {
        res.render('registration/receipt', { registration: registration , layout:false });
      }
    });
});

router.all('/finish', utils.require_user);
router.all('/finish', utils.require_permission('registration/desk'));
router.post('/finish', function(req, res, next) {
  var regid = req.body.regid;
  Registration.findOne({where: {id:regid}, include: [User, RegistrationPayment]})
    .then(function(registration) {
      registration.badge_printed = true;
      registration.save();

      var previous = null;
      if(req.body.printed) {
        previous = req.body.printed;
      }

      res.render('desk/finish', { registration: registration, previous: previous } );
    });
});

router.all('/badge', utils.require_user);
router.all('/badge', utils.require_permission('registration/desk'));
router.get('/badge', function(req, res, next) {
  var regida = req.query.regida;
  var regidb = req.query.regidb;
  Registration.findOne({where: {id:regida}, include: [User]})
    .then(function(rega) {
      Registration.findOne({where: {id:regidb}, include: [User]})
        .then(function(regb) {
          var rega_name = "";
          var regb_name = "";
          if(!!rega) {
            rega_name = rega.User.name;
          }
          if(!!regb) {
            regb_name = regb.User.name;
          }
          req.app.render('desk/badge_svg', {
              rega_name: rega_name,
              regb_name: regb_name,
              layout: false
          }, function(err, html) {
            if(!!err) {
              res.status(500).send('Error generating badge: ' + err);
            } else {
              mktemp.createFile(os.tmpdir() + '/_guadec_regcfgp_badge_XXXXX.svg', function(err, path) {
                console.log('Temporary filename: ' + path);
                if(!!err) {
                  res.status(500).send('Unable to generate file: ' + err);
                } else {
                  fs.writeFile(path, html, function(err) {
                    if(!!err) {
                      res.status(500).send('Unable to write temp file: ' + err);
                    } else {
                      var child = exec('inkscape -f ' + path + ' -A ' + path + '.pdf -z', function(err, stdout, stderr) {
                        if(!!err) {
                          res.status(500).send('Error generating pdf: ' + err);
                        } else {
                          console.log('OUTPUT error: ' + stderr);
                          res.status(200).set('Content-Type', 'application/pdf');
                          var filestream = fs.createReadStream(path + '.pdf');
                          filestream.pipe(res);
                        }
                      });
                    }
                  });

                }
              });
            }
          //res.status(200).set('Content-Type', 'image/svg+xml').render('desk/badge_svg', { rega: rega, regb: regb, layout: false });
          });
        });
    });
});

router.all('/payment/markpaid', utils.require_user);
router.all('/payment/markpaid', utils.require_permission('registration/desk'));
router.post('/payment/markpaid', function(req, res, next) {
  var regid = req.body.regid;
  Registration.findOne({where: {id:regid}, include: [RegistrationPayment]})
    .then(function(registration) {
      for(payment in registration.RegistrationPayments) {
        payment = registration.RegistrationPayments[payment];
        if(!payment.paid && payment.type == 'onsite') {
          payment.paid = true;
          payment.save();
        }
      }
      res.redirect('/desk?paid=' + regid);
    });
});

router.all('/payment/clear', utils.require_user);
router.all('/payment/clear', utils.require_permission('registration/desk'));
router.post('/payment/clear', function(req, res, next) {
  var regid = req.body.regid;
  Registration.findOne({where: {id:regid}, include: [RegistrationPayment]})
    .then(function(registration) {
      for(payment in registration.RegistrationPayments) {
        payment = registration.RegistrationPayments[payment];
        if(!payment.paid && payment.type == 'onsite') {
          payment.destroy();
        }
      }
      res.redirect('/desk?cleared=' + regid);
    });
});

router.all('/payment/add', utils.require_user);
router.all('/payment/add', utils.require_permission('registration/desk'));
router.post('/payment/add', function(req, res, next) {
  var regid = req.body.regid;
  Registration.findOne({where: {id:regid}})
    .then(function(registration) {
      var payment_info = {
        currency: req.body.currency,
        amount: req.body.amount,
        paid: true,
        type: 'onsite',
      };
      RegistrationPayment.create(payment_info)
        .complete(function(err, payment) {
          if(!!err) {
            res.status(500).send('Error saving payment: ' + err);
          } else {
            registration.addRegistrationPayment(payment)
              .complete(function(err) {
                if(!!err) {
                  res.status(500).send('Error attaching payment to reg: ' + err);
                } else {
                  res.redirect('/desk?added=' + regid + '&amount=' + req.body.amount);
                }
              });
          }
        });
    });
});

module.exports = router;
