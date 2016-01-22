var express = require('express');
var router = express.Router();

var utils = require('../../utils');

var models = require('../../models');
var User = models.User;

router.all('/register', utils.require_login);
router.get('/register', function(req, res, next) {
  res.render('auth/register', { origin: req.query.origin });
});

router.post('/register', function(req, res, next) {
  var fullname = req.body.fullname.trim();
  var origin = req.body.origin;
  if(origin == null || origin[0] != '/') {
    origin = '/';
  };

  if(fullname == '') {
    res.redirect(302, '/auth/register?origin=' + origin);
    return;
  }

  User.find({
    where: {
      email: req.session.currentUser
    }
  }).catch(function(error) {
      res.status(500).send('Error retrieving user object');
  }).then(function(user) {
    if(!user) {
      // Create the user
      var user = User.create({
        email: req.session.currentUser,
        name: fullname
      }).then(function(user) {
        res.redirect(origin);
      });
    } else {
      // The user already existed...
      res.redirect(302, '/');
    }
  });

});

module.exports = router;
