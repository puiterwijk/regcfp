var express = require('express');
var router = express.Router();

var models = require('../models');
var User = models.User;

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/../config/config.json')[env];


/* GET home page. */
router.get('/', function(req, res, next) {
  if(req.session.currentUser)
  {
    User
      .find({
        where: {
          email: req.session.currentUser
        }
      })
      .complete(function(err, user) {
        if(user) {
          res.render('index/index', { 'name': user.name });
        } else {
          res.render('index/index', { 'name': req.session.currentUser });
        }
      });
  } else {
    res.render('index/index', { });
  }
});

module.exports = router;
