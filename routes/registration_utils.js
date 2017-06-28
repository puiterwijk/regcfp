var regutils = {};

var Promise = require("bluebird");

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;
var RegistrationInfo = models.RegistrationInfo;

const util = require('util')

var config = require('../configuration');

var countries = require('country-data').countries;
countries.all_assigned = (countries.all
  .filter(function(c) { return c.status == 'assigned'; })
  .sort(function(a, b) { return a.name.localeCompare(b.name); }));

// Returns a list of field values for a given registration.
//
// The values will be in this order: first the name, then the email if
// show_private is true, then the value of each field from 'field_ids' in the
// same order as that list.
regutils.show_registration = function(registration, field_ids, show_private,
                                      show_payment) {
  const fields = config['registration']['fields'];
  var cur_reg = [];
  if (show_private) {
    cur_reg.push(registration["User"].id);
  }
  cur_reg.push(registration['User'].name);
  var field_values = regutils.get_reg_fields(null, registration, !show_private);

  if (show_private) {
    cur_reg.push(registration['User'].email);
  }

  for(var field in field_ids) {
    field = field_ids[field];
    if(field != null && field.type != "documentation" && field.type != "legend") {
      var value = field_values[field].value;
      if (show_payment && value && value != 'None' && fields[field].type == 'purchase') {
        value += " (payment: " + field_values[field].payment_state + ")";
      }
      if(typeof value == "string") {
        value = value.replace(/\r\n/g, "\n");
      }
      cur_reg.push(value);
    }
  }

  if(show_payment) {
    cur_reg.push(registration.paid);
    cur_reg.push(registration.regfee);
    cur_reg.push("Item #regfee:" + registration["User"].email);
    //cur_reg.push(registration.outstanding_onsite);
  }

  return cur_reg;
}

// For each 'purchase' type field in the registration form, this function
// counts how many times each option has already been selected and
// checks against the configured maximum.
//
// The result is the same 'fields' dictionary that was passed in, with
// additional options.left properties set for any 'purchase' type fields.
regutils.query_inventory = function(reg, fields) {
  var fields_to_check = Object.keys(fields)
    .filter(function(name) { return fields[name].type == 'purchase' });

  var all_promises = fields_to_check.map(function(field_name) {
    var field = fields[field_name];

    var options = field.options;

    var options_to_check = Object.keys(options)
      .filter(function(name) { return options[name].limit > 0 });

    var count_promises = options_to_check.map(function(option_name) {
      // Here we count the number of purchases of a single option, by querying
      // the database of existing registrations.
      var option = options[option_name];

      var reg_where = {};
      if (reg) {
        reg_where = {
          /* Not this user. */
          'id' : {
            ne : reg.id
          }
        };
      }

      return new Promise(function (resolve, reject) {
        Registration.count(
          {
            include: [{
              model: RegistrationInfo,
              'where' : {
                'field' : field_name,
                'value' : option_name,
              }
            }],
            'where' : reg_where
          }
        ).then(function(count) {
          var left = Math.max(0, option.limit - count);
          option.left = left;
          resolve();
        })
      });
    });

    return Promise.all(count_promises);
  });

  return new Promise(function (resolve, reject) {
    Promise.all(all_promises).then(function(result) {
      resolve(fields);
    });
  });
}

// Check if registration submission is valid.
//
// If 'reg' is set, it's treated as an existing registration that
// would be updated with the new field values.
//
// Returns null if there is no error, or a string describing the problem
// if an error is found.
regutils.check_field_values = function(reg, field_values) {
  for (var fieldname in field_values) {
    var field = field_values[fieldname];
    console.log("Verifying field " + fieldname);
    console.log("Fieldinfo: " + util.inspect(field, {showHidden: false, depth: null}));
    if (field['type'] == 'string') {
      if (field['required'] && field['value'].trim() == '')
        return "Required field '" + field['display_name'] + "' was not set";
    } else if (field['type'] == 'select') {
      if (field['required']) {
        /* Check whether the option exists. */
        if (field['options'].indexOf(field['value']) == -1) {
          return "Invalid choice '" + field['value'] + "' for field '" + field['display_name'] + "'";
        }
      }
    } else if (field['type'] == 'purchase') {
      var option = field['options'][field['value']];

      if (reg) {
        for(var info in reg.RegistrationInfos) {
          info = reg.RegistrationInfos[info];
          if (info.field == fieldname && info.value != 'None' && info.value != field['value']) {
            if (info.RegistrationPayment != null) {
              return "You cannot change purchase choices after payment, for field: " + field['display_name'];
            }
          }
        }
      }

      if (option == undefined) {
        if (field['required']) {
          return "Invalid choice '" + field['value'] + "' for field '" + field['display_name'] + "'";
        };
      } else {
        if (option['left'] !== undefined) {
          if (option['left'] == 0)
            return "No more '" + field['value'] + "' purchases available for field: " + field['display_name'];
        }
      };
    }
  }
  return null;
}

const fill_reg_fields_from_stored_registration = function(fields, registration) {
  // Each RegistrationInfo record in the database stores a single field+value
  // pair for the given user.
  for(var info in registration.RegistrationInfos) {
    info = registration.RegistrationInfos[info];
    var field = fields[info.field];
    field.value = info.value;

    if (field.type == 'purchase' && info.RegistrationPayment != null) {
      if (info.RegistrationPayment.paid == false) {
        field.payment_state = 'pending';
        field.can_change = false;
      } else {
        field.payment_state = 'paid';
        field.can_change = false;
      }
    }
  }
}

const fill_reg_fields_from_form_submission = function(fields, request_body) {
  for(var field in fields) {
    if (fields[field].type == "boolean") {
      // Checkbox <input> tags send no value when unchecked, so we need to set
      // a default for each 'boolean' type field.
      fields[field].value = "false";
    }

    if (('field_' + field) in request_body) {
      if (fields[field].type == "boolean") {
        // Any value for a boolean indicates the <input> was checked.
        fields[field].value = "true";
      } else {
        fields[field].value = request_body['field_' + field];
      }
    }
  };
};

// Given a price in one currency, generate text showing the prices in all
// configured currencies.
const render_cost_in_currencies = function(cost, main_currency, currencies) {
  var list = [currencies[main_currency].symbol + Math.ceil(cost)];
  Object.keys(currencies).forEach(function(id) {
    if (id != main_currency)
      list.push(currencies[id].symbol + Math.ceil(cost * currencies[id].conversion_rate));
  });
  return list.join(' / ');
};


// List all registration fields that are defined in the configuration file.
//
// Returns an array of objects representing the fields.
//
// The keys of the array are the field names from the config file.
//
// Each field object carries the properties that were defined in the
// config file. See README.md for documentation of those.
//
// Additional properties that are set by this function:
//
//   - `value`: set from the optional `request` parameter (which should be an
//     appropriate HTTP POST request) or `registration` parameter (which should
//     be a models.Registration object).
//   - `payment_state`: for purchase fields, can be one of "unpaid", "pending"
//     or "paid". Only set if the `registation` parameter was set.
//   - `can_change`: true if the field can be changed. We don't allow changing
//     purchase fields if a payment has already been made.
//
// NOTE: you must ensure the associations are queried for the Registration
// object, or payments will silently be ignored. Use the following code:
//
//    user.getRegistration({include: [RegistrationPayment, { model: RegistrationInfo, include: RegistrationPayment }]})
//
regutils.get_reg_fields = function (request, registration, skip_internal) {
  if (request)
    console.log("Update reg fields: req.body: %j", request['body']);
  var fields = {};
  for(var field_name in config['registration']['fields']) {
    if (skip_internal && config['registration']['fields'][field_name]['internal'])
      continue;

    fields[field_name] = Object.assign({}, config['registration']['fields'][field_name]);

    var field = fields[field_name];

    field.can_change = true;

    if(field['type'] == 'country') {
      field['type'] = 'select';
      var options = Object.assign([], field['options']);
      for(var country in countries.all_assigned) {
        options.push(countries.all_assigned[country].name);
      };
      field['options'] = options;
    }
    else
    if (field['type'] == 'purchase') {
      field['payment_state'] = 'unpaid';
      Object.keys(field['options']).forEach(function (option_name) {
        var option = field['options'][option_name];
        option['cost_all_currencies'] = render_cost_in_currencies(
                option['cost'], config.registration.main_currency,
                config.registration.currencies);
      });
    }

    // Some properties can be given as a list of strings. This is a
    // workaround because JSON syntax doesn't support multiline strings.
    ['html', 'message', 'text'].forEach(function(field_name) {
      if (field[field_name] instanceof Array)
        field[field_name] = field[field_name].join('');
    })
  };

  // Values in the request body (i.e. a new form submission) override values
  // from the stored registration.
  if (registration) {
    fill_reg_fields_from_stored_registration(fields, registration);
  }

  if (request) {
    fill_reg_fields_from_form_submission(fields, request.body);
  }

  return fields;
}

// Get information about the new purchase choices from a given registration.
//
// Returns an array of objects, which for each purchase lists the name of
// the field, the name of the chosen option, the cost of that option (in
// `currency`), and whether payment was made yet.
regutils.get_reg_purchase_choices = function(reg, fields, currency_id) {
  var currency = config.registration.currencies[currency_id]
  var conversion_rate = currency.conversion_rate;
  var result = [];
  Object.keys(fields).forEach(function(field_name) {
    var field = fields[field_name];
    if (field.type == 'purchase') {
      var option = field['options'][field['value']];
      if (option) {
        var payment = reg.get_payment_for_purchase(field_name);
        result.push({
          'field_name': field_name,
          'field_display_name': field['display_name'],
          'option_name': field['value'],
          'option_display_name': option['display_name'] || field['value'],
          'cost': Math.ceil(option.cost * conversion_rate),
          'cost_display': currency.symbol + Math.ceil(option.cost * conversion_rate),
          'paid': payment != null && payment.paid
        });
      };
    };
  });
  return result;
};

regutils.get_reg_purchase_choices_unpaid = function(reg, fields, currency_id) {
  var purchase_choices = regutils.get_reg_purchase_choices(reg, fields, currency_id);
  return purchase_choices.filter(function(purchase) { return (purchase.paid == false) });
}

regutils.get_reg_purchase_choices_paid = function(reg, fields, currency_id) {
  var purchase_choices = regutils.get_reg_purchase_choices(reg, fields, currency_id);
  return purchase_choices.filter(function(purchase) { return (purchase.paid == true) });
}

regutils.make_paypal_sku_for_purchase = function(field_name, option_name) {
  return [ config.registration.payment_sku_prefix, field_name, option_name ]
  .map(function (str) { return str.replace(':', '_'); })
  .join(':')
  .substring(0, 127);
};

module.exports = regutils;
