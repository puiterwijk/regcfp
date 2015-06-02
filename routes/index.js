var express = require('express');
var router = express.Router();

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/../config/config.json')[env];


/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.session.currentUser)
  {
    if(req.user) {
      req.user.getRegistration({include: [RegistrationPayment]})
      .complete(function(err, reg) {
        res.render('index/index', { name: req.user.name, registration: reg });
      });
    } else {
      res.render('index/index', { name: req.session.currentUser });
    }
  } else {
    res.render('index/index', { });
  }
});

module.exports = router;
