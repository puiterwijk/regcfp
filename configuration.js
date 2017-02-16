var config = {}

var env = process.env.NODE_ENV || "development";
if(env == "test") {
  var config = require(__dirname + '/config/config.example.json')['development'];

  config.auth.module = 'test';
  config.database.storage = ':memory:';
} else {
  var config = require(__dirname + '/config/config.json')[env];
}

/* Remove trailing slash from site_url if present */
config.site_url = config.site_url.replace(/\/$/, "");

config.env = env;

module.exports = config;
