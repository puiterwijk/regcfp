var express = require('express');
var router = express.Router();

var browserid = require('browserid-verify')();

var models = require('../models');
var User = models.User;

var env       = process.env.NODE_ENV || "development";
var persona_audience    = require(__dirname + '/../config/config.json')[env]['persona_audience'];
if(!!process.env.OPENSHIFT_APP_NAME)
{
  if(!!process.env.PERSONA_AUDIENCE)
  {
    persona_audience = process.env.PERSONA_AUDIENCE;
  }
  else
  {
    persona_audience = 'http://' + process.env.OPENSHIFT_APP_DNS
  }
}
console.log('Persona audience: ' + persona_audience);

function invalid_type(req, res, next) {
  res.status(401).send('Invalid request type');
}

router.get('/login', invalid_type);
router.get('/logout', invalid_type);

router.post('/login', function(req, res, next) {
  var assertion = req.body.assertion;
  console.log('Assertion: ' + assertion);

  browserid(assertion, persona_audience,
    function(err, email, response) {
      if(err) {
        console.log('Invalid BrowserID assertion: ' + err);
        res.status(500).send('Invalid assertion!');
        return;
      }
      if(email == null) {
        console.log('BrowserID without email: ' + response);
        res.status(500).send('Assertion did not check out!');
        return;
      }

      console.log('Welcoming ' + email + ': ' + response);
      req.session.currentUser = email;
      req.session.currentUserAssertion = assertion;
      req.session.currentUserDetails = response;
      res.send('Logged in!');
    });
});

router.post('/logout', function(req, res, next) {
  req.session.currentUser = null;
  req.session.currentUserAssertion = null;
  req.session.currentUserDetails = null;
  req.session.destroy(function(err) {});
  res.send('Logged out');
});

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

  User.find({
    where: {
      email: req.session.currentUser
    }
  })
  .complete(function(err, user) {
    if(!!err) {
      res.status(500).send('Error retrieving user object');
    } else if(!user) {
      // Create the user
      var user = User.create({
        email: req.session.currentUser,
        name: fullname
      }).complete(function(err, user) {
        res.redirect(origin);
      });
    } else {
      // The user already existed...
      res.redirect(302, '/');
    }
  });

});

module.exports = router;
