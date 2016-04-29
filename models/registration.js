"use strict";

var config = require('../configuration');

function get_amount_string(amounts) {
  var amount = "";
  console.log("amount str: " + amounts);
  for(var cur in amounts) {
    if(amount != "") {
      amount += ", ";
    }
    amount += config['registration']['currencies'][cur]['symbol'];
    amount += Math.ceil(amounts[cur]);
  }
  return amount;
}

module.exports = function(sequelize, DataTypes) {
  var Registration = sequelize.define("Registration", {
    is_public: DataTypes.BOOLEAN,
    badge_printed: DataTypes.BOOLEAN,
    receipt_sent: DataTypes.BOOLEAN,
  }, {
    classMethods: {
      associate: function(models) {
        Registration.belongsTo(models.User);
        Registration.hasMany(models.RegistrationPayment);
        Registration.hasMany(models.RegistrationInfo);
      }
    },
    getterMethods: {
      display_id: function() {
        return this.id;
      },

      paid_amounts: function() {
        var amounts = {};
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(payment.paid) {
            if(payment.currency in amounts) {
              amounts[payment.currency] += payment.amount;
            } else {
              amounts[payment.currency] = payment.amount;
            }
          }
        }
        return amounts;
      },
      paid: function() {
        return get_amount_string(this.paid_amounts);;
      },
      outstanding_onsite: function() {
        var amounts = {};
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(!payment.paid && payment.type == 'onsite') {
            if(payment.currency in amounts) {
              amounts[payment.currency] += payment.amount;
            } else {
              amounts[payment.currency] = payment.amount;
            }
          }
        }
        return get_amount_string(amounts);
      },
      has_outstanding_onsite: function() {
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(!payment.paid && payment.type == 'onsite') {
            return true;
          }
        }
        return false;
      }
    }
  });

  return Registration;
};
