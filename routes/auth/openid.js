// auth/openid:
//
// Identifies a user using OpenID 2.0 or OpenID Connect.
//
// The initial design of OpenID was that users provide a URL to identify
// themselves. Initially it was designed mostly for bloggers to comment on
// other blogs, so the idea was you'd identify yourself with the URL of your
// blog. The blog you're commenting on would use the provided URL as an OpenID
// endpoint and ask it to confirm that the user did indeed control that URL.
// It was up to the OpenID provider how it did this, but usually it meant
// asking for a password or validating an existing session cookie.
//
// OpenID 2.0 introduced the concept of "identifier select" which allows the
// user to provide a more generic URL and then be prompted by the OpenID
// provider about what identity they want to return. We use this system to
// provide a "Log in with $PROVIDER" button which takes the user straight to
// the provider's login screen whichsaves users from having to have a URL
// memorized before they can log in.
//
// The OpenID protocol initially avoided returning anything except whether
// the user had authorized themself successfully but the SimpleRegistration
// extension was later added to provide other details like their name and email
// address. It depends on the provider whether that address is a *verified*
// email address.
//
// With OpenID Connect we get roughly the same functionality. It's actually a
// separate protocol built on top of OAuth2 and it dispenses with the concept
// of "URL as identifier" that previous iterations of OpenID have been based
// around. Ideally we would only support OpenID Connect but at the time of
// writing not all providers we are interested in using support it.
//
// OpenID 2.0 support is provided by:
//   <https://github.com/havard/node-openid>
//
// OpenID Connect support is provided by:
//   <https://github.com/panva/node-openid-client>.
//
// Notes on the history of OpenID:
// <https://willnorris.com/2009/07/openid-directed-identity-identifier-select>.
//
// You can find decent documentation of the OpenID Connect "server" flow
// here: <https://developers.google.com/identity/protocols/OpenIDConnect>.

var express = require('express');
var router = express.Router();

var openid = require('openid')
var openid_client = require('openid-client')

const crypto = require('crypto');

var utils = require('../../utils');

var models = require('../../models');
var User = models.User;

const config = require('../../configuration')

router.openid_2_0 = new openid.RelyingParty(
  config['site_url'] + '/auth/login/2.0/return',  // Our callback URL
  config['site_url'],  // Realm
  true,                // Use stateless verification?
  false,               // Strict mode
  [                    // Extensions
    new openid.SimpleRegistration({'email': 'required'})
  ]);

openid_2_0_login_handler = function(req, res, next) {
  var provider_url = req.body.openid_2_0_provider_url;

  if (! provider_url) {
    return res.redirect(config['site_url']);
  };

  router.openid_2_0.authenticate(provider_url, false, function(error, auth_url) {
    if (error || !auth_url) {
      console.log("auth/login/2.0: Error: %s", error['message'] || "No auth_url was returned");
      req.session.error = ("There was a problem resolving " + provider_url);
      return res.redirect(config['site_url']);
    } else {
      return res.redirect(auth_url);
    };
  });
};

router.get('/login/2.0/return', function(req, res, next) {
  router.openid_2_0.verifyAssertion(req, function(error, openid_response) {
    if (error || !openid_response.authenticated) {
      console.log("auth/login/2.0/return: Error: %j", error);
      req.session.error = "There was a problem verifying your OpenID";
      return res.redirect(config['site_url']);
    } else {
      console.log("Welcoming user %s (email: %s)",
          openid_response.claimedIdentifier, openid_response.email);
      if (!openid_response.email || !openid_response.claimedIdentifier) {
        console.log("auth/login/2.0/return: Not all information returned by provider");
        req.session.error = "The OpenID provider did not return all required information";
      } else {
        // This assumes that the OpenID provider has verified that the
        // user owns this email address. It's very important to only accept
        // logins from providers that give us a *verified* email address.
        req.session.currentUser = openid_response.email;
      }
      return res.redirect(config['site_url']);
    };
  });
});

// On startup, we iterate through the configured OpenID Connect providers and
// authenticate as a client with each one. The resulting Client objects are
// saved in the `router.openid_connect_providers` property.
//
// Note that our client credentials aren't actually checked at this point, if
// they are invalid then you won't get an error until someone tries to log in
// using that provider.
//
// This init() hook expects that the app uses the 'express-init' extension.
router.init = function(app, callback) {
  var provider_names = Object.keys(config.auth.openid_connect_providers);
  var openid_connect_promises = provider_names.map(function(provider_name) {
      provider = config.auth.openid_connect_providers[provider_name];
      console.log("auth.openid.connect: %s: Trying to discover OpenID Connect " +
          "provider at %s", provider_name, provider.discovery_url);

      return openid_client.Issuer.discover(provider.discovery_url)
        .then(function (issuer) {
          console.log("auth.openid.connect: %s: Discovery successful. " +
            "Authorization endpoint: %s", provider_name,
            issuer.metadata['authorization_endpoint']);
          info = {};
          info[provider_name] = new issuer.Client({
              client_id: provider.client_id,
              client_secret: config.auth.client_secret,
            })
          return info;
        });
    });

  Promise.all(openid_connect_promises).then(function(infos) {
    router.openid_connect_providers = Object();
    infos.forEach(function(info) {
      router.openid_connect_providers = Object.assign(router.openid_connect_providers, info);
    })
  })
  .then(callback);
};

router.openid_connect_auth_callback_url = config['site_url'] + '/auth/login/connect/return'

openid_connect_login_handler = function(req, res, next) {
  var provider_name = req.body['openid_connect_provider'];
  var provider = router.openid_connect_providers[provider_name];

  if (!provider_name || !provider) {
    console.log("/auth/login/connect: Bad provider %s", provider_name);
    return res.redirect(config['site_url']);
  };

  req.session.provider_name = provider_name;

  // This is a security token which allows us to validate responses on our
  // /login/connect/return/ endpoint.
  req.session.state = crypto.randomBytes(32).toString('hex');

  const auth_url = provider.authorizationUrl({
    redirect_uri: router.openid_connect_auth_callback_url,
    scope: 'openid email',
    state: req.session.state,
  })
  res.redirect(auth_url);
};

router.get('/login/connect/return', function(req, res, next) {
  var provider_name = req.session.provider; delete req.session.provider;
  var state = req.session.state; delete req.session.state;

  var provider = router.openid_connect_providers[provider_name];
  var params = provider.callbackParams(req)
  return provider.authorizationCallback(router.openid_connect_auth_callback_url, params, { state })
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
      console.log("auth/login/connect/return: Error: %s", e);
      req.session.error = ("There was a problem communicating with the " +
                           "'" + provider_name + "' OpenID Connect server. " +
                           "Please contact the admins of this site.");
      return res.redirect(config['site_url']);
    });
});

logout_handler = function(req, res, next) {
  req.session.currentUser = null;
  req.session.destroy(function(err) {
    return res.redirect(config['site_url']);
  });
};

login_get_handler = function(req, res, next) {
  // We expect login to be via POST request (e.g. form submission), it won't
  // work for GET methods because the parameters will be in req.query not
  // req.body.
  console.log("Ignoring GET request to login endpoint");
  return res.redirect(config['site_url']);
};

router.get('/login/2.0', login_get_handler);
router.get('/login/connect', login_get_handler);

router.post('/login/2.0', openid_2_0_login_handler);
router.post('/login/connect', openid_connect_login_handler);
router.get('/logout', logout_handler);
router.post('/logout', logout_handler);

module.exports = router;
