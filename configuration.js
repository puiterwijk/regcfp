var config = {}

var env = process.env.NODE_ENV || "development";
var config = require(__dirname + '/config/config.json')[env];

// TODO: Do config another way

config.env = env;

module.exports = config;
