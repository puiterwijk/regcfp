var express = require('express');
var router = express.Router();

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/../config/config.json')[env];

var utils = require('../utils');


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

router.all('/view_name', utils.require_permission('registration/view_name'));
router.post('/view_name', function(req, res, next) {
  var userid = req.body.userid;
  User.findOne({where: {id:userid}, include: [Registration]})
    .then(function(user) {
      res.render('index/view_user', { user: user });
    });
});

module.exports = router;
