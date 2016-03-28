"use strict";

module.exports = function(sequelize, DataTypes) {
  var Paper = sequelize.define("Paper", {
    title: DataTypes.STRING,
    summary: DataTypes.TEXT,
    type: DataTypes.STRING,
    track: DataTypes.STRING,
    accepted: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        Paper.belongsTo(models.User);
        Paper.hasMany(models.PaperVote);
        Paper.hasMany(models.PaperTag);
        Paper.hasMany(models.PaperCoPresenter);
      }
    }
  });

  return Paper;
};
