// auth/openid:
//
// Identifies a user using OpenID Connect.
//
// OpenID Connect is an identity layer on top of Oauth2.
// During the login process, the identity of the user is confirmed, after which
// they are asked what personally identifiable information they are willing to
// share with the Service Provider.
//
// OpenID Connect support is provided by:
//   <https://github.com/panva/node-openid-client>.
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

var inspect = require('util').inspect;

const config = require('../../configuration')

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
  var openid_connect_providers = config.auth['openid_connect_providers'];
  if (!openid_connect_providers) {
    callback();
    return;
  };

  var needs_legacy_callback = null;
  var provider_names = Object.keys(openid_connect_providers);
  var openid_connect_promises = provider_names.map(function(provider_name) {
      if (provider_name == 'connect' && needs_legacy_callback) {
        throw new Error('It is not possible to have a provider called "connect" together with a provider that needs legacy callback');
      } else if (provider_name == 'connect') {
        needs_legacy_callback = false;
      }

      provider = config.auth.openid_connect_providers[provider_name];
      if (provider.legacy_callback) {
        if (needs_legacy_callback === false) {
          throw new Error('It is not possible to have a provider called "connect" together with a provider that needs legacy callback');
        } else {
          console.log('auth.openid.connect: %s: Provider needed legacy callback',
              provider_name);
          needs_legacy_callback = true;
        }
      }
      console.log("auth.openid.connect: %s: Trying to discover OpenID Connect " +
          "provider at %s", provider_name, provider.discovery_url);

      if (!provider.legacy_callback) {
        router.get('/login/' + provider_name + '/return', function(req, res, next) {
          return openid_connect_login_complete_handler(req, res, next, provider_name);
        });
      }
      router.get('/login/' + provider_name, function(req, res, next) {
        return openid_connect_init_login(req, res, next, provider_name);
      });

      return openid_client.Issuer.discover(provider.discovery_url)
        .then(function (issuer) {
          console.log("auth.openid.connect: %s: Discovery successful. " +
            "Authorization endpoint: %s", provider_name,
            issuer.metadata['authorization_endpoint']);
          info = {};
          info[provider_name] = new issuer.Client({
              client_id: provider.client_id,
              client_secret: provider.client_secret,
            })
          return info;
        });
    });

  if (needs_legacy_callback) {
    router.get('/login/connect/return', function(req, res, next) {
      var provider_name = req.session.provider; delete req.session.provider;
      return openid_connect_login_complete_handler(req, res, next, provider_name);
    });
  }


  Promise.all(openid_connect_promises).then(function(infos) {
    router.openid_connect_providers = Object();
    infos.forEach(function(info) {
      router.openid_connect_providers = Object.assign(router.openid_connect_providers, info);
    })
  })
  .then(callback);
};

openid_connect_login_handler = function(req, res, next) {
  var provider_name = req.body['openid_connect_provider'];

  if (!provider_name || !provider) {
    console.log("/auth/login/connect: Bad provider %s", provider_name);
    return res.redirect(config['site_url']);
  };

  return openid_connect_init_login(req, res, next, provider_name);
}

function openid_connect_init_login(req, res, next, provider_name) {
  var provider = router.openid_connect_providers[provider_name];
  var provider_info = config.auth.openid_connect_providers[provider_name];

  req.session.provider = provider_name;

  // This is a security token which allows us to validate responses on our
  // /login/$providername/return/ endpoint.
  req.session.state = crypto.randomBytes(32).toString('hex');

  var claims = {};
  if (provider_info.email_domain) {
    claims["userinfo"] = {"nickname": {"essential": true}};
  } else {
    claims["userinfo"] = {"email": {"essential": true}};
  }
  var callback_url;
  if (provider_info.legacy_callback) {
    callback_url = config['site_url'] + '/auth/login/connect/return';
  } else {
    callback_url = config['site_url'] + '/auth/login/' + provider_name + '/return';
  }
  const auth_url = provider.authorizationUrl({
    redirect_uri: callback_url,
    scope: 'openid',
    state: req.session.state,
    claims: claims,
  })
  res.redirect(auth_url);
};

function openid_connect_login_complete_handler(req, res, next, provider_name) {
  var state = req.session.state; delete req.session.state;

  var provider = router.openid_connect_providers[provider_name];
  var provider_info = config.auth.openid_connect_providers[provider_name];
  var callback_url;
  if (provider_info.legacy_callback) {
    callback_url = config['site_url'] + '/auth/login/connect/return';
  } else {
    callback_url = config['site_url'] + '/auth/login/' + provider_name + '/return';
  }

  var params = provider.callbackParams(req)
  return provider.authorizationCallback(callback_url, params, { state })
    .then(function (token_set) {
      access_token = token_set.access_token;
      return provider.userinfo(access_token);
    })
    .then(function (userinfo) {
      var user_email;
      if (provider_info.email_domain) {
        user_email = userinfo.nickname + '@' + provider_info.email_domain;
      } else {
        user_email = userinfo.email;
      }
      console.log("Welcoming user %s", user_email);
      req.session.currentUser = user_email;
      return res.redirect(config['site_url']);
    })
    .catch(function (e) {
      console.log("auth/login/connect/return: Error: " + inspect(e));
      req.session.error = ("There was a problem communicating with the " +
                           "'" + provider_name + "' OpenID Connect server. " +
                           "Please contact the admins of this site.");
      return res.redirect(config['site_url']);
    });
}

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

router.get('/login/connect', login_get_handler);
router.post('/login/connect', openid_connect_login_handler);
router.get('/logout', logout_handler);
router.post('/logout', logout_handler);

module.exports = router;
