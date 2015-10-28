"use strict";

module.exports = function(sequelize, DataTypes) {
  var PaperCoPresenter = sequelize.define("PaperCoPresenter", {
  }, {
    classMethods: {
      associate: function(models) {
        PaperCoPresenter.belongsTo(models.User);
        PaperCoPresenter.belongsTo(models.Paper);
      }
    }
  });

  return PaperCoPresenter;
};
