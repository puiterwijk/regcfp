var express = require('express');
var router = express.Router();

var browserid = require('browserid-verify')();

var utils = require('../../utils');

var models = require('../../models');
var User = models.User;

var persona_audience    = require('../../configuration')['auth']['persona_audience'];
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
        res.status(401).send('Invalid assertion!');
        return;
      }
      if(email == null) {
        console.log('BrowserID without email: ' + response);
        res.status(400).send('Assertion did not check out!');
        return;
      }

      console.log('Welcoming ' + email + ': ' + response);
      req.session.currentUser = email;
      req.session.currentUserAssertion = assertion;
      req.session.currentUserDetails = response;
      res.send('Welcome ' + email);
    });
});

router.post('/logout', function(req, res, next) {
  req.session.currentUser = null;
  req.session.currentUserAssertion = null;
  req.session.currentUserDetails = null;
  req.session.destroy(function(err) {
    res.send('Logged out');
  });
});

router.buttons = {
  login: {
    onclick: 'javascript: navigator.id.request(login_args);',
  },
  logout: {
    onclick: 'javascript: navigator.id.logout();',
  }
};

router.middleware = function(req, res, next) {
  res.locals.extra_js.push('/javascripts/login-persona.js');
  res.locals.extra_js.push('https://login.persona.org/include.js');
  next();
};

module.exports = router;
