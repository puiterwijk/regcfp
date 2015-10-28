"use strict";

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define("User", {
    email: DataTypes.STRING,
    name: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        User.hasMany(models.Paper);
        User.hasMany(models.PaperVote);
        User.hasMany(models.PaperCoPresenter);
        User.hasOne(models.Registration);
        User.hasMany(models.Email);
      }
    }
  });

  return User;
};
