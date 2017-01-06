"use strict";

var Promise = require('bluebird');

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

function get_amounts(reg, type) {
  var amounts = {};
  for(var payment in reg.RegistrationPayments) {
    payment = reg.RegistrationPayments[payment];
    if(payment.paid && (type === undefined || type == payment.type)) {
      if(payment.currency in amounts) {
        amounts[payment.currency] += payment.amount;
      } else {
        amounts[payment.currency] = payment.amount;
      }
    }
  }
  return amounts;
}

// Associate RegistrationPayment with the RegistrationInfo entry that logged
// the user's purchase.
//
// This allows us to determine whether a purchase has been paid for yet.
function associate_payment_with_purchase(reg, payment, field, option) {
  for(var info in reg.RegistrationInfos) {
    info = reg.RegistrationInfos[info];
    if (info.field == field) {
      if (info.value != option) {
        console.warn("Associating payment for " + field + " choice " +
                     info.value + " but expected choice " + option);
      }
      return info.setRegistrationPayment(payment);
    }
  };
  console.warn(": Couldn't associate payment with field " + field + " choice " +
               option + ": value is not set in this registration");
  return Promise.resolve();
}

function get_payment_for_purchase(reg, field) {
  for (var info_id in reg.RegistrationInfos) {
    var info = reg.RegistrationInfos[info_id];
    if (info.field == field) {
      return info.RegistrationPayment;
    }
  }
  return null;
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
    instanceMethods: {
      associate_payment_with_purchase: function(payment, field, option) {
        associate_payment_with_purchase(this, payment, field, option);
      },
      get_payment_for_purchase: function(field) {
        return get_payment_for_purchase(this, field);
      }
    },
    getterMethods: {
      display_id: function() {
        return this.id;
      },

      paid_amounts: function() {
        return get_amounts(this);
      },
      paid: function() {
        return get_amount_string(this.paid_amounts);
      },
      paid_paypal: function() {
        return get_amount_string(get_amounts(this, 'paypal'));
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
      },
      has_confirmed_payment: function() {
        for(var payment in this.RegistrationPayments) {
          console.log('payment:', payment);
          payment = this.RegistrationPayments[payment];
          if(payment.paid) {
            return true;
          }
        }
        return false;
      },
    }
  });

  return Registration;
};
