"use strict";

module.exports = function(sequelize, DataTypes) {
  var Email = sequelize.define("Email", {
    sent: DataTypes.BOOLEAN,
    subject: DataTypes.STRING,
    body: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        Email.belongsTo(models.User);
      }
    }
  });

  return Email;
};
