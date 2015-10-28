"use strict";

module.exports = function(sequelize, DataTypes) {
  var PaperTag = sequelize.define("PaperTag", {
    tag: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        PaperTag.belongsTo(models.Paper);
      }
    }
  });

  return PaperTag;
};
