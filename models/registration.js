"use strict";

var env       = process.env.NODE_ENV || "development";
var config = require('../config/config.json')[env];

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

      info_values: function() {
        var values = {};
        for(var info in this.RegistrationInfos) {
          info = this.RegistrationInfos[info];
          values[info.field] = info.value;
        }
        return values;
      },

      left_for_receipt: function() {
        // This is quite a difficult function, and probably could use comments
        var main_cur = config['registration']['main_currency'];
        var main_cur_amount = 0;
        var amounts = {};
        var needed = {};
        for(var currency in config['registration']['currencies']) {
          amounts[currency] = 0;
          needed[currency] = config['registration']['currencies'][currency]['min_amount_for_receipt'];
        }
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(payment.paid) {
            amounts[payment.currency] += payment.amount;
            needed[payment.currency] -= payment.amount;
          }
        }
        var amount_in_main_currency = 0;
        for(var cur in amounts) {
          console.log("Cur: " + cur + ", needed: " + needed[cur]);
          if(needed[cur] <= 0) {
            // Easy case: we have a currency which passed the threshold
            return {};
          }
          amount_in_main_currency += (amounts[cur] * config['registration']['currencies'][cur]['conversion_rate']);
          if(amount_in_main_currency >= config['registration']['currencies'][main_cur]['min_amount_for_receipt']) {
            // After conversion, they paid enough
            return {};
          }
        }
        // It wasn't enough. Let's calculate the amounts needed to satisfy
        var still_needed_main_currency = config['registration']['currencies'][main_cur]['min_amount_for_receipt'] - amount_in_main_currency;

        for(var cur in amounts) {
          needed[cur] = still_needed_main_currency / config['registration']['currencies'][cur]['conversion_rate'];
        }
        return needed;
      },
      
      eligible_for_receipt: function() {
        return Object.keys(this.left_for_receipt).length === 0;
      },
      needed_for_receipt: function() {
        return get_amount_string(this.left_for_receipt);
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
      outstanding_paypal: function() {
        var amounts = {};
        for(var payment in this.RegistrationPayments) {
          payment = this.RegistrationPayments[payment];
          if(!payment.paid && payment.type == 'paypal') {
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
