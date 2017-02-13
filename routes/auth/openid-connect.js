// auth/openid-connect:
//
// Identifies a user using an OpenID Connect authority.
//
// This should™ work with any OpenID Connect provider. It has been tested
// against Ipsilon: <https://pagure.io/ipsilon/>.
//
// You can find decent documentation of the OpenID Connect "server" flow
// here: <https://developers.google.com/identity/protocols/OpenIDConnect>.

var express = require('express');
var router = express.Router();

var openid_client = require('openid-client')

const crypto = require('crypto');

var utils = require('../../utils');

var models = require('../../models');
var User = models.User;

const config = require('../../configuration')

// This init() hook expects that the app uses the 'express-init' extension.
router.init = function(app, callback) {
  const issuer_url = config.auth.issuer;
  console.log("auth/openid-connect: Trying to discover ID provider %s", issuer_url);

  openid_client.Issuer.discover(issuer_url)
    .then(function (issuer) {
      router.client = new issuer.Client({
        client_id: config.auth.client_id,
        client_secret: config.auth.client_secret,
      });

      console.log("auth/openid-connect: Discovery successful. Authorization " +
          "endpoint: %s", issuer.metadata['authorization_endpoint']);

      callback();
    })
};

router.auth_callback_url = config['site_url'] + '/auth/login/return'

router.post('/login', function(req, res, next) {
  req.session.state = crypto.randomBytes(32).toString('hex');

  const auth_url = router.client.authorizationUrl({
    redirect_uri: router.auth_callback_url,
    scope: 'openid email',
    state: req.session.state,
  })
  res.redirect(auth_url);
});

router.get('/login/return', function(req, res, next) {
  state = req.session.state; delete req.session.state;

  params = router.client.callbackParams(req)
  return router.client.authorizationCallback(router.auth_callback_url, params, { state })
    .then(function (token_set) {
      access_token = token_set.access_token;
      return router.client.userinfo(access_token);
    })
    .then(function (userinfo) {
      const user_email = userinfo.email;
      console.log("Welcoming user %s", user_email);
      req.session.currentUser = user_email;
      return res.redirect(config['site_url']);
    })
    .catch(function (e) {
      console.log("auth/openid-connect: Error: %s", e);
      req.session.error = ("There was a problem communicating with the " +
                           "configured OpenID Connect server. Please " +
                           "contact the admins of this site.");
      return res.redirect(config['site_url']);
    });
})

router.post('/logout', function(req, res, next) {
  req.session.currentUser = null;
  req.session.destroy(function(err) {
    return res.redirect(config['site_url']);
  });
});

function invalid_type(req, res, next) {
  res.status(401).send('Invalid request type');
}
router.get('/login', invalid_type);
router.get('/logout', invalid_type);

router.buttons = {
  login:  'type="submit" formmethod="post" formaction="/auth/login"',
  logout: 'type="submit" formmethod="post" formaction="/auth/logout"'
};

module.exports = router;
