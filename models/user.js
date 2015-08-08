"use strict";

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define("User", {
    email: DataTypes.STRING,
    name: DataTypes.STRING,
    isInelligbileForRaffle: DataTypes.BOOLEAN,
    isVolunteer: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        User.hasMany(models.Paper);
        User.hasMany(models.PaperVote);
        User.hasOne(models.Registration);
      }
    }
  });

  return User;
};
