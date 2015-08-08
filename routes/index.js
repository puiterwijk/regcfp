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

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

router.all('/view_name', utils.require_permission('registration/view_name'));
router.get('/view_name', function(req, res, next) {
  var everyone = req.query.everyone;
  User.findAll({include: [Registration]})
    .then(function(users) {
      var users2 = [];
      for(var user in users) {
        user = users[user];
        if(user.Registration && user.Registration.badge_printed && !user.isInelligbileForRaffle && (everyone || user.isVolunteer)) {
          users2.push(user);
        }
      };
      shuffle(users);
      var name = null;
      if(req.query.index) {
        name = users[req.query.index].name;
      }
      res.render('index/view_user', { count: users2.length, name: name, everyone: everyone });
    });
});

module.exports = router;
