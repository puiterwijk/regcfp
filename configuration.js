var config = {}

var env = process.env.NODE_ENV || "development";
if(env == "test") {
  var config = require(__dirname + '/config/config.example.json')['development'];

  config.auth.module = 'test';
  config.database.storage = ':memory:';

  // We can't really test payment...
  config.permissions.registration.pay = [];
  config.permissions.registration.add_payment = [];
} else {
  var config = require(__dirname + '/config/config.json')[env];
}

config.env = env;

module.exports = config;
