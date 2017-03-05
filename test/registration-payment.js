var request = require('supertest');
var Promise = require('bluebird')
var paypal = require('paypal-rest-sdk')

var app = require('../app');
var config = require('../configuration');
var models = require('../models');

var assert = require('assert')

function set_user(agent, email) {
   return agent.post('/auth/logout').expect(200)
   .then(function() {
     return agent.post('/auth/login').send({'email': email}).expect(200)
   });
};

function simple_registration(options) {
  return {
    'name': options.name || ('Payment Test User'),
    'field_ircnick': options.ircnick || ('testirc'),
    'is_public': options.is_public || 'true',
    'currency': options.currency || 'EUR',
    'field_t_shirt': options.t_shirt || 'None',
    'field_room': options.room || 'None',
    'regfee': options.regfee || 0
  }
}

function get_registration_for_user(email) {
   return models.User.findOne({email: email})
   .then(function(user) { return user.getRegistration({ include: [models.RegistrationPayment] }); })
}

function paypal_payment_response() {
  return {
    'links': [ { 'rel': 'approval_url', 'href': 'paypal.com' } ]
  }
}

describe('payment-paypal', function() {
  var agent = request.agent(app);

  before('Make sure all tables exist', function(done) {
    app.db.sequelize.sync({force: true})
    .then(function() {
      done();
    });
  });

  it('should charge correct amount for purchases and regfee', function(done) {
    set_user(agent, 'payment-test-2@regcfp')
    .then(function() {
      agent.post('/registration/register')
      .send(simple_registration({regfee: 39, room: '2 nights', currency: 'EUR'}))
      .expect(/You chose a registration fee of €39/)
      .expect(/2 nights/)
      .expect(/<form[^>]+action="\/registration\/pay\/do"/)
      .end(done)
    })
  })

  it('should forward user to PayPal for payment', function(done) {
    paypal.payment.create = function(create_payment, callback) {
      var items = create_payment.transactions[0].item_list.items;
      assert.equal(items.length, 2);
      assert.equal(items[0].price, 39);
      assert.equal(items[0].currency, 'EUR');
      assert.equal(items[1].price, Math.ceil(40 * config.registration.currencies['EUR'].conversion_rate));
      assert.equal(items[1].currency, 'EUR');
      callback(null, paypal_payment_response());
    };
    agent.post('/registration/pay/do')
    .send({'regfee-method': 'paypal'})
    .expect(302)
    .expect(/paypal\.com/)
    .end(done)
  })

  // No payment has been made yet; let's pretend the user closed the PayPal
  // window and forgot about their registration for a few weeks...

  it('should list regfee and purchase as unpaid in admin view', function(done) {
    set_user(agent, 'payadm@regcfp').then(function() {
      // FIXME: For some reason we need to register  ... ?
      return agent.post('/registration/register')
      .send(simple_registration({regfee: 1}))
    }).then(function() {
      agent
      .get('/registration/admin/list')
      .expect(200)
      .expect(/<td>2 nights \(payment: unpaid\)<\/td>\n<td><\/td>/)
      .end(done)
    })
  })

  it('should not give a receipt yet', function(done) {
    set_user(agent, 'payment-test-2@regcfp').then(function() {
      agent.get('/registration/receipt')
      .expect('We do not have any confirmed payments for this registration.')
      .end(done)
    })
  })

  it('should allow changing registration fee and currency before payment is made', function(done) {
    set_user(agent, 'payment-test-2@regcfp')
    .then(function() {
      agent.post('/registration/register')
      .send(simple_registration({regfee: 29, room: '2 nights', currency: 'GBP'}))
      .expect(/Your registration was updated/)
      .expect(/You chose a registration fee of £29/)
      .expect(/2 nights/)
      .expect(/<form[^>]+action="\/registration\/pay\/do"/)
      .end(done)
    })
  })

  it('should allow changing purchase choice before payment is made', function(done) {
    set_user(agent, 'payment-test-2@regcfp')
    .then(function() {
      agent.post('/registration/register')
      .send(simple_registration({regfee: 29, room: '1 night', currency: 'GBP'}))
      .expect(/Your registration was updated/)
      .expect(/You chose a registration fee of £29/)
      .expect(/1 night/)
      .expect(/<form[^>]+action="\/registration\/pay\/do"/)
      .end(done)
    })
  })

  it('should allow making the payment later on from the main screen', function(done) {
    var saved_transactions = null;

    agent.get('/registration/pay')
    .expect(/You chose a registration fee of £29/)
    .expect(/1 night/)
    .expect(/<form[^>]+action="\/registration\/pay\/do"/)
    .then(function() {
      paypal.payment.create = function(create_payment, callback) {
        var items = create_payment.transactions[0].item_list.items;
        assert.equal(items.length, 2);
        assert.equal(items[0].price, 29);
        assert.equal(items[0].currency, 'GBP');
        assert.equal(items[1].price, 20);
        assert.equal(items[1].currency, 'GBP');
        saved_transactions = create_payment.transactions;
        callback(null, paypal_payment_response());
      };
      return agent.post('/registration/pay/do')
      .send({'regfee-method': 'paypal'})
      .expect(302)
      .expect(/paypal\.com/)
    })
    .then(function() {
      // Simulate a successful PayPal payment
      paypal.payment.execute = function(paymentID, execute_payment, callback) {
        callback(null, { transactions: saved_transactions, state: 'approved' });
      };
      agent.post('/registration/pay/paypal/execute')
      .expect(200)
      .end(done)
    })
  })

  // Payment has now been made and should be recorded in the database.

  it('should not ask for payment if no further payment is needed', function(done) {
    agent.post('/registration/register')
    .send(simple_registration({regfee: 29, currency: 'GBP', room: '1 night', ircnick: 'someone else'}))
    .expect(/Your registration was updated, thank you!/)
    .expect(function(res) {
      assert(res.text.search(/You have chosen the following purchases, which must be paid for now/) == -1);
      assert(res.text.search(/You chose a registration fee of £19/) == -1);
      assert(res.text.search(/The total to be paid now is/) == -1);
    })
    .end(done)
  })

  it('should list regfee and purchase as paid in admin view', function(done) {
    set_user(agent, 'payadm@regcfp').then(function() {
      agent
      .get('/registration/admin/list')
      .expect(200)
      .expect(/<td>1 night \(payment: paid\)<\/td>\n<td>£49<\/td>/)
      .end(done)
    })
  })

  it('should give a receipt now', function(done) {
    set_user(agent, 'payment-test-2@regcfp').then(function() {
      agent.get('/registration/receipt')
      .expect(/We received your payment of £49/)
      .expect(/1 night/)
      .end(done)
    })
  })

  it('should prevent changing registration fee after payment is made', function(done) {
    agent.post('/registration/register')
    .send(simple_registration({regfee: 99, currency: 'GBP', room: '1 night'}))
    .expect(/You cannot change your registration fee because you have already paid./)
    .end(done)
  })

  it('should prevent changing currency after payment is made', function(done) {
    agent.post('/registration/register')
    .send(simple_registration({regfee: 29, currency: 'EUR', room: '1 night'}))
    .expect(/You cannot change your preferred currency because you have already paid./)
    .end(done)
  })

  it('should prevent purchase changes after payment', function(done) {
    agent.post('/registration/register')
    .send(simple_registration({regfee: 29, currency: 'GBP', room: '2 nights'}))
    .expect(/You cannot change purchase choices after payment, for field: Accommodation booking/)
    .end(done);
  });

  it('should allow choosing a purchase that was previously None', function(done) {
    agent.post('/registration/register')
    .send(simple_registration({regfee: 29, currency: 'GBP', room: '1 night', t_shirt: 'S'}))
    .expect(/Your registration was updated, thank you!/)
    .expect(/T-shirt: S/)
    .expect(/<form[^>]+action="\/registration\/pay\/do"/)
    .expect(function(res) {
      // Don't mention the stuff that has already been paid for.
      assert(res.text.search(/You chose a registration fee of/) == -1);
      assert(res.text.search(/1 night/) == -1);
    })
    .end(done)
  })

  it('should not include the unpaid item in the receipt yet', function(done) {
    set_user(agent, 'payment-test-2@regcfp').then(function() {
      agent.get('/registration/receipt')
      .expect(/We received your payment of £49/)
      .expect(/1 night/)
      .expect(function(res) {
        assert(res.text.search(/T-shirt/) == -1);
      }).end(done)
    })
  })
  it('should take a payment for the new purchase', function(done) {
    var saved_transactions = null;

    agent.get('/registration/pay')
    .expect(/T-shirt: S/)
    .expect(/<form[^>]+action="\/registration\/pay\/do"/)
    .then(function() {
      paypal.payment.create = function(create_payment, callback) {
        var items = create_payment.transactions[0].item_list.items;
        assert.equal(items.length, 1);
        assert.equal(items[0].price, 20);
        assert.equal(items[0].currency, 'GBP');
        saved_transactions = create_payment.transactions;
        callback(null, paypal_payment_response());
      };
      return agent.post('/registration/pay/do')
      .expect(302)
      .expect(/paypal\.com/)
    })
    .then(function() {
      // Simulate a successful PayPal payment
      paypal.payment.execute = function(paymentID, execute_payment, callback) {
        callback(null, { transactions: saved_transactions, state: 'approved' });
      };
      agent.post('/registration/pay/paypal/execute')
      .expect(200)
      .end(done)
    })
  })

  it('should list regfee and both purchases as paid in admin view', function(done) {
    set_user(agent, 'payadm@regcfp').then(function() {
      agent
      .get('/registration/admin/list')
      .expect(200)
      .expect(/<td>S \(payment: paid\)<\/td>\n<td>1 night \(payment: paid\)<\/td>\n<td>£69<\/td>/)
      .end(done)
    })
  })

  it('should give a receipt for all payments and purchases', function(done) {
    set_user(agent, 'payment-test-2@regcfp').then(function() {
      agent.get('/registration/receipt')
      .expect(/We received your payment of £69/)
      .expect(/1 night/)
      .expect(/T-shirt/)
      .end(done)
    })
  })

  it('should allow making a further donation online', function(done) {
    var saved_transactions = null;

    agent.get('/registration/pay')
    .expect(/£69 paid/)
    .expect(/Additional fees:/)
    .expect(/<form[^>]+action="\/registration\/pay\/do"/)
    .then(function() {
      paypal.payment.create = function(create_payment, callback) {
        var items = create_payment.transactions[0].item_list.items;
        assert.equal(items.length, 1);
        assert.equal(items[0].price, 21);
        assert.equal(items[0].currency, 'EUR');
        saved_transactions = create_payment.transactions;
        callback(null, paypal_payment_response());
      };
      return agent.post('/registration/pay/do')
      // We should be able to donate in a different currency to the one
      // we registered with.
      .send({donation: '21', currency: 'EUR'})
      .expect(302)
      .expect(/paypal\.com/)
    })
    .then(function() {
      // Simulate a successful PayPal payment
      paypal.payment.execute = function(paymentID, execute_payment, callback) {
        callback(null, { transactions: saved_transactions, state: 'approved' });
      };
      agent.post('/registration/pay/paypal/execute')
      .expect(200)
      .end(done)
    })
  })

  it('should still give a receipt for all payments and purchases', function(done) {
    set_user(agent, 'payment-test-2@regcfp').then(function() {
      agent.get('/registration/receipt')
      .expect(/We received your payment of £69, €21/)
      .expect(/1 night/)
      .expect(/T-shirt/)
      .end(done)
    })
  })
});

describe('payment-onsite', function() {
  var agent = request.agent(app);

  before('Make sure all tables exist', function(done) {
    app.db.sequelize.sync({force: true})
    .then(function() {
      done();
    });
  });

  it('should offer onsite payment for registration fee only', function(done) {
    set_user(agent, 'payment-test-1@regcfp')
    .then(function() {
      return agent
      .post('/registration/register')
      .send(simple_registration({regfee: 19, currency: 'GBP'}))
      .expect(/<form[^>]+action="\/registration\/pay\/do"/)
      .expect(/You chose a registration fee of £19/)
    })
    .then(function() {
      return agent
      .post('/registration/pay/do')
      .send({'regfee-method': 'onsite'})
      .expect(200)
      .expect(/You will be asked to pay for your registration at the Registration Desk/)
    })
    .then(function() {
      get_registration_for_user('payment-test-1@regcfp').then(function(reg) {
        assert(reg.has_outstanding_onsite)
        assert.equal(reg.outstanding_onsite, "£19")
        done();
      })
    })
  });

  it('should offer onsite payment for registration fee and PayPal for purchases', function(done) {
    set_user(agent, 'payment-test-2@regcfp')
    .then(function() {
      return agent
      .post('/registration/register')
      .send(simple_registration({regfee: 19, room: '1 night', currency: 'GBP'}))
      .expect(/<form[^>]+action="\/registration\/pay\/do"/)
      .expect(/You chose a registration fee of £19/)
    })
    .then(function() {
      paypal.payment.create = function(create_payment, callback) {
        var items = create_payment.transactions[0].item_list.items;
        assert.equal(items.length, 1);
        assert.equal(items[0].price, 20);
        assert.equal(items[0].currency, 'GBP');
        callback(null, paypal_payment_response());
      };
      return agent
      .post('/registration/pay/do')
      .send({'regfee-method': 'onsite'})
      .expect(302)
      .expect(/paypal\.com/)
    })
    .then(function() {
      get_registration_for_user('payment-test-1@regcfp').then(function(reg) {
        assert(reg.has_outstanding_onsite)
        assert.equal(reg.outstanding_onsite, "£19")
        done();
      })
    })
  });
});
