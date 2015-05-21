"use strict";

module.exports = function(sequelize, DataTypes) {
  var PaperVote = sequelize.define("PaperVote", {
    comment: DataTypes.STRING,
    vote: DataTypes.INTEGER,
    abstained: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        PaperVote.belongsTo(models.User);
        PaperVote.belongsTo(models.Paper);
      }
    }
  });

  return PaperVote;
};
