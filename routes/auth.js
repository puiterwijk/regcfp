var express = require('express');
var router = express.Router();

var browserid = require('browserid-local-verify');

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

  browserid.verify({
    assertion: assertion,
    audience: persona_audience,
  }, function(err, details) {
    if(err == null)
    {
      req.session.currentUser = details['email'];
      req.session.currentUserAssertion = assertion;
      req.session.currentUserDetails = details;
      res.send('Logged in!');
    } else {
      console.log('Invalid BrowserID assertion: ' + err);
      res.status(500).send('Invalid assertion!');
    }
  });
});

router.post('/logout', function(req, res, next) {
  req.session.currentUser = null;
  req.session.currentUserAssertion = null;
  req.session.currentUserDetails = null;
  req.session.destroy(function(err) {});
  res.send('Logged out');
});

module.exports = router;
