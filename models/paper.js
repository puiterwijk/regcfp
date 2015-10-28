"use strict";

module.exports = function(sequelize, DataTypes) {
  var Paper = sequelize.define("Paper", {
    title: DataTypes.STRING,
    summary: DataTypes.TEXT,
    track: DataTypes.STRING,
    accepted: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        Paper.belongsTo(models.User);
        Paper.hasMany(models.PaperVote);
      }
    }
  });

  return Paper;
};
