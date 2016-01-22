var config = {}

var env = process.env.NODE_ENV || "development";
if(env == "test") {
  var config = require(__dirname + '/config/config.example.json')['development'];
} else {
  var config = require(__dirname + '/config/config.json')[env];
}

config.env = env;

module.exports = config;
