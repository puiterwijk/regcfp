"use strict";

module.exports = function(sequelize, DataTypes) {
  var RegistrationInfo = sequelize.define("RegistrationInfo", {
    field: DataTypes.STRING,
    value: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        RegistrationInfo.belongsTo(models.Registration);
      }
    }
  });

  return RegistrationInfo;
};
