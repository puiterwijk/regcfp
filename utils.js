var utils = {}

utils.require_login = function(req, res, next) {
  if(req.session.currentUser == null)
  {
    res.redirect(302, '/');
  } else {
    next();
  }
};

module.exports = utils;
