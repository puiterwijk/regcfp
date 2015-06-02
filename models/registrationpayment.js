"use strict";

module.exports = function(sequelize, DataTypes) {
  var RegistrationPayment = sequelize.define("RegistrationPayment", {
    amount: DataTypes.FLOAT,
    paid: DataTypes.BOOLEAN,
    type: DataTypes.ENUM('paypal', 'onsite'),
    details: DataTypes.STRING,
  }, {
    classMethods: {
      associate: function(models) {
        RegistrationPayment.belongsTo(models.Registration);
      }
    }
  });

  return RegistrationPayment;
};
