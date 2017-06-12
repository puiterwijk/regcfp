"use strict";

module.exports = function(sequelize, DataTypes) {
  var RegistrationInfo = sequelize.define("RegistrationInfo", {
    field: DataTypes.STRING,
    value: DataTypes.TEXT
  }, {
    classMethods: {
      associate: function(models) {
        RegistrationInfo.belongsTo(models.Registration);
        // Purchase fields get associated with the payment that covered the
        // purchase.
        RegistrationInfo.belongsTo(models.RegistrationPayment);
      }
    }
  });

  return RegistrationInfo;
};
