var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;

var all_genders = ['male', 'female', 'other'];

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
  var regfee = req.body.regfee;
  if(regfee == 'custom')
  {
    regfee = req.body.regfee_custom.trim();
  }
  
  if(regfee == null) {
    res.render('registration/pay');
  } else {
    res.render('registration/pay_do', {regfee: regfee});
  }
});

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
  } else {
    res.status(402).send('Invalid payment method selected');
  }
});

router.all('/register', utils.require_user);
router.all('/register', utils.require_permission('registration/register'));
router.get('/register', function(req, res, next) {
  req.user.getRegistration()
  .complete(function(err, reg) {
    res.render('registration/register', { registration: reg, genders: all_genders });
  });
});

router.post('/register', function(req, res, next) {
  req.user.getRegistration({include: [RegistrationPayment]})
  .complete(function(err, reg) {
    console.log('Body: ' + JSON.stringify(req.body));
    var reg_info = {
      irc: req.body.irc.trim(),
      is_public: req.body.is_public.indexOf('true') != -1,
      gender: req.body.gender,
      country: req.body.country.trim(),
      badge_printed: false,
      receipt_sent: false,
      UserId: req.user.Id,
      is_not_saved: true
    };

    console.log("Reg info: " + JSON.stringify(reg_info));

    var regfee = req.body.regfee;
    if(regfee == 'custom')
    {
      regfee = req.body.regfee_custom.trim();
    }

    if((all_genders.indexOf(reg_info.gender) == -1) || (reg == null && regfee == null)) {
      res.render('registration/register', { registration: reg_info, genders: all_genders,
                                            submission_error: true});
    } else {
      // Form OK
      if(reg == null) {
        console.log("CREATING");
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
        console.log("UPDATING");
        reg.irc = reg_info.irc;
        reg.is_public = reg_info.is_public;
        reg.gender = reg_info.gender;
        reg.country = reg_info.country;
        reg.save().complete(function (err, reg){
          if(!!err) {
            res.render('registration/register', { registration: reg_info, genders: all_genders,
                                                  save_error: true });
          } else {
            res.render('registration/update_success');
          }
        });
      }
    }
  });
});


router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('registration/view_all'));
router.get('/admin/list', function(req, res, next) {
  next();
});

module.exports = router;
