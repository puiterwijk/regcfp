"use strict";

module.exports = function(sequelize, DataTypes) {
  var Registration = sequelize.define("Registration", {
    irc: DataTypes.STRING,
    is_public: DataTypes.BOOLEAN,
    badge_printed: DataTypes.BOOLEAN,
    receipt_sent: DataTypes.BOOLEAN,
    gender: DataTypes.ENUM('male', 'female', 'other'),
    country: DataTypes.STRING,
  }, {
    classMethods: {
      associate: function(models) {
        Registration.belongsTo(models.User);
        Registration.hasMany(models.RegistrationPayment);
      }
    },
    getterMethods: {
      display_id: function() {
        return this.id;
      },
      paid: function() {
        var amount = 0;
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(payment.paid) {
            amount += payment.amount;
          }
        }
        return amount;
      },
      outstanding: function() {
        var amount = 0;
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(!payment.paid) {
            amount += payment.amount;
          }
        }
        return amount;
      }
    }
  });

  return Registration;
};
