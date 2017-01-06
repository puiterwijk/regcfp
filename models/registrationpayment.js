"use strict";

module.exports = function(sequelize, DataTypes) {
  var RegistrationPayment = sequelize.define("RegistrationPayment", {
    currency: DataTypes.STRING(3),
    amount: DataTypes.FLOAT,
    paid: DataTypes.BOOLEAN,
    type: DataTypes.ENUM('paypal', 'onsite'),
    details: DataTypes.STRING,
  }, {
    classMethods: {
      associate: function(models) {
        RegistrationPayment.belongsTo(models.Registration);
        RegistrationPayment.hasMany(models.RegistrationInfo);
      }
    }
  });

  return RegistrationPayment;
};
