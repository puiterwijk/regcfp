var express = require('express');
var router = express.Router();

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;
var RegistrationInfo = models.RegistrationInfo;

var config = require('../configuration');

var utils = require('../utils');
var regutils = require('./registration_utils');


/* GET home page. */
router.get('/', function(req, res, next) {
  const error = req.session['error']; delete req.session['error'];

  if(req.session.currentUser)
  {
    if(req.user) {
      req.user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
      .then(function(reg) {
        res.render('index/index', { name: req.user.name, registration: reg,
                                    registration_fields: regutils.get_reg_fields(null, reg, true),
                                    error: error });
      });
    } else {
      res.render('index/index', { name: req.session.currentUser, error: error });
    }
  } else {
    res.render('index/index', { error: error });
  }
});

module.exports = router;
