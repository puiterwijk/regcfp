var request = require('supertest');
var Promise = require('bluebird')
var app = require('../app');
var models = require('../models');

var child_process = require('child_process');

var check_for_inkscape = function() {
  try {
    child_process.execSync('inkscape --version');
    return true;
  }
  catch (err) {
    console.warn("Skipping tests that require Inkscape: " + err);
    return false;
  };
}
var inkscape_found = check_for_inkscape();

function set_user(agent, email, done) {
   agent.post('/auth/logout')
   .expect(200)
   .end(function() {
     agent.post('/auth/login')
     .send({'email': email})
     .expect(200)
     .end(done);
   });
};

describe('registration', function() {
  var agent = request.agent(app);

  before('Make sure all tables exist', function(done) {
    app.db.sequelize.sync({force: true})
    .then(function() {
      done();
    });
  });

  // Initial login
  it('should refuse access to registration', function(done) {
    agent.get('/registration/register')
    .expect(401)
    .end(done);
  });

  it('should login', function(done) {
    agent.post('/auth/login')
    .send({'email': 'usera@regcfp'})
    .expect(200)
    .expect('Welcome usera@regcfp')
    .end(done);
  });

  // Displaying registration form
  it('should show registration form', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(/name="name" value=""/)
    .expect(/Hide my name/)
    .end(done);
  });

  it('should show prepended country', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(/<select\s*name="field_country_pre"[^>]*>\s*<option[^>]*>prepended country<\/option>/m)
    .end(done);
  });

  it('should show documentation HTML', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(/docentry/)
    .expect(/<h3>Documentation test html<\/h3>/)
    .end(done);
  });

  it('should not show internal fields', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(function (res) { if (res.text.match('Internal')) throw new Error('Contains string "Internal".'); })
    .end(done);
  });

  it('should show form on empty name', function(done) {
    agent.post('/registration/register')
    .send({'name': '  '})
    .expect(200)
    .expect(/name="name" value=""/)
    .expect(/Hide my name/)
    .end(done);
  });

  it('should handle empty forms', function(done) {
    agent.post('/registration/register')
    .expect(200)
    .expect(/name="name" value=""/)
    .expect(/Hide my name/)
    .end(done);
  });

  // Submission
  it('should allow registration', function(done) {
    agent.post('/registration/register')
    .send({'name': 'TestUser A'})
    .send({'field_ircnick': 'testirc'})
    .send({'is_public': 'true'})
    .send({'field_volunteer': 'on'})
    .send({'currency': 'EUR'})
    .send({'field_shirtsize': 'M'})
    .send({'regfee': '0'})
    .send({'age': '3000 years'})
    .expect(200)
    .expect(/Thanks for registering/)
    .end(done);
  });

  // Listing all registrations
  it('should list registrations', function(done) {
    agent.get('/registration/list')
    .expect(200)
    .expect(/TestUser A/)
    .expect(function (res) { if (res.text.match('[^\'"]usera@regcfp[^\'"]')) throw new Error('Mail should not be included!'); })
    .expect(function (res) { if (res.text.match('Internal')) throw new Error('Internal fields should not be included!'); })
    .end(done)
  });

  it('list should not show documentation fields', function(done) {
    agent.get('/registration/list')
    .expect(200)
    .expect(function (res) { if (res.text.match('docentry')) throw new Error('String found!'); })
    .end(done)
  });

  it('should not allow access to full registration view', function(done) {
    agent.get('/registration/admin/list')
    .expect(401) // Unauthorized
    .end(done);
  });

  // Editing existing registration
  it('should show filled in registration form', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(/name="name" value="TestUser A"/)
    .expect(/name="regfee" class="reg-fee" value="0"/)
    .expect(/name="field_volunteer" checked="checked"/)
    .expect(/option value="EUR"[^>]*selected="selected"/)
    .expect(/Hide my name/)
    .end(done);
  });

  it('should allow updates', function(done) {
    agent.post('/registration/register')
    .send({'name': 'TestUser A'})
    .send({'field_ircnick': 'testirc'})
    // Not sending it defaults to false. And this adds another tested line.
    //.send({'is_public': 'false'})
    .expect(200)
    .expect(/Your registration was updated, thank you/)
    .end(done);
  });

  // Proof that this works to check the DB
//  it('country ends up in database', function(done) {
//    var res = agent.post('/registration/register')
//    .send({'name': 'TestUser A'})
//    .send({'field_ircnick': 'testirc'})
//    .send({'field_country': 'testing'})
//    .expect(200)
//    .then(function() {
//      models.RegistrationInfo.count({'where' : { 'field' : 'country', 'value' : 'testing' }})
//        .then(function (count) {
//          if (count == 0)
//            done(new Error('Field did not end ended up in database!'))
//          else
//            done();
//        });
//    });
//  });

//  it('documentation fields are ignored when storing into database', function(done) {
//    var res = agent.post('/registration/register')
//    .send({'name': 'TestUser A'})
//    .send({'field_ircnick': 'testirc'})
//    .send({'field_doc': 'testing'})
//    .expect(200)
//    .then(function() {
//      models.RegistrationInfo.count({'where' : { 'field' : 'doc', 'value' : 'testing' }})
//        .then(function (count) {
//          if (count != 0)
//            done(new Error('Field end ended up in database!'))
//          else
//            done();
//        });
//    });
//  });

  it('should show the payment form', function(done) {
    agent.get('/registration/pay')
    .expect(200)
    .expect(/<form[^>]+action="\/registration\/pay\/do\"/)
    .end(done);
  });

  it('should show payment choice', function(done) {
    agent.post('/registration/pay')
    .expect(200)
    .expect(/paypal/)
    .expect(/onsite/)
    .end(done);
  });

  it('should show payment form on blank', function(done) {
    agent.post('/registration/pay')
    .expect(200)
    .expect(/<form[^>]+action="\/registration\/pay\/do"/)
    .end(done);
  });

  // Test admin stuff
  it('logout second user', function(done) {
    agent.post('/auth/logout')
    .expect(200)
    .expect('Logged out')
    .end(done);
  });

  it('should login as admin', function(done) {
    agent.post('/auth/login')
    .send({'email': 'admin@regcfp'})
    .expect(200)
    .expect('Welcome admin@regcfp')
    .end(done);
  });

  it('register admin', function(done) {
    agent.post('/authg/register')
    .send({'origin': '/papers/submit'})
    .send({'fullname': 'Admin'})
    .end(done);
  });

  it('should allow registration by admin', function(done) {
    agent.post('/registration/register')
    .send({'name': 'Admin'})
    .send({'field_ircnick': 'adminnick'})
    .send({'field_shirtsize': 'M'})
    .send({'is_public': 'true'})
    .send({'currency': 'EUR'})
    .send({'regfee': '0'})
    .expect(200)
    .expect(/Thanks for registering/)
    .end(done);
  });

  it('should list all info for admin (except payment and stats)', function(done) {
    agent.get('/registration/admin/list')
    .expect(200)
    .expect(/TestUser A/)
    .expect(/testirc/)
    .expect(/usera@regcfp/)
    .expect(/Admin/)
    .expect(/adminnick/)
    .expect(/Internal/)
    .expect(function (res) {
      if (res.text.match('Paid')) throw new Error('String "Paid" found!');
      if (res.text.match('Age')) throw new Error('Aggregate-only field was displayed');
    })
    .end(done);
  });

  // Desk system
  it('should show desk', function(done) {
    agent.get('/desk')
    .expect(200)
    .expect(/TestUser A/)
    .expect(/Admin/)
    .end(done);
  });

  it('should show desk add', function(done) {
    agent.get('/desk/add')
    .expect(200)
    .expect(/Your name/)
    .end(done);
  });

  it('should allow desk add', function(done) {
    agent.post('/desk/add')
    .send({'email': 'userc@regcfp'})
    .send({'name': 'TestUser C'})
    .send({'irc': 'test'})
    .send({'gender': 'test'})
    .send({'country': 'test'})
    .send({'is_public': 'false'})
    .expect(200)
    .expect(/Please return the laptop to the desk./)
    .end(done);
  });

  it('should show added user', function(done) {
    agent.get('/desk')
    .expect(200)
    .expect(/TestUser A/)
    .expect(/Admin/)
    .expect(/TestUser C/)
    .end(done);
  });

  it('should accept payment add', function(done) {
    agent.post('/desk/payment/add')
    .send({'regid': '2'})
    .send({'currency': 'EUR'})
    .send({'amount': '25'})
    .expect(302)
    .expect('Location', '/desk?added=2&amount=25')
    .end(done);
  });

  it('should detect desk receipt requirement', function(done) {
    agent.get('/desk/receipt/?regid=2')
    .expect(200)
    .expect(/your payment of €25/)
    .end(done);
  });

  it('should accept clear', function(done) {
    agent.post('/desk/payment/clear')
    .send({'regid': '2'})
    .expect(302)
    .expect('Location', '/desk?cleared=2')
    .end(done);
  });

  it('should accept markpaid', function(done) {
    agent.post('/desk/payment/markpaid')
    .send({'regid': '1'})
    .expect(302)
    .expect('Location', '/desk?paid=1')
    .end(done);
  });

  it('should show desk message new_id', function(done) {
    agent.get('/desk/?new_id=1')
    .expect(200)
    .expect(/Registration 1 was added/)
    .end(done);
  });

  it('should show desk message paid', function(done) {
    agent.get('/desk/?paid=1')
    .expect(200)
    .expect(/Registration 1 was marked as paid/)
    .end(done);
  });

  it('should show desk message cleared', function(done) {
    agent.get('/desk/?cleared=1')
    .expect(200)
    .expect(/Payments for 1 were cleared/)
    .end(done);
  });

  it('should show desk message added', function(done) {
    agent.get('/desk/?added=1&amount=10')
    .expect(200)
    .expect(/Payment of 10 registered for 1/)
    .end(done);
  });

  it('should show desk message printed', function(done) {
    agent.get('/desk/?printed=1')
    .expect(200)
    .expect(/Registration 1 was finished/)
    .expect(/Please finish a second one to print badges/)
    .end(done);
  });

  it('should accept finish', function(done) {
    agent.post('/desk/finish')
    .send({'regid': '1'})
    .send({'printed': '2'})
    .expect(200)
    .expect(/Click here to print badge/)
    .end(done);
  });

  /*it('should print badge', function(done) {
    if (!inkscape_found) {
      this.skip();
    } else {
      agent.get('/desk/badge?regida=1&regidb=2')
      .expect(200)
      .expect(/%PDF-1./)
      .end(done);
    };
  });*/

  it('logout admin user', function(done) {
    agent.post('/auth/logout')
    .expect(200)
    .expect('Logged out')
    .end(done);
  });

  it('should login as payment admin', function(done) {
    agent.post('/auth/login')
    .send({'email': 'payadm@regcfp'})
    .expect(200)
    .expect('Welcome payadm@regcfp')
    .end(done);
  });

  it('register payment admin', function(done) {
    agent.post('/authg/register')
    .send({'origin': '/papers/submit'})
    .send({'fullname': 'Payment Admin'})
    .end(done);
  });

  it('should list all info for payment admin', function(done) {
    agent.get('/registration/admin/list')
    .expect(200)
    .expect(/TestUser A/)
    .expect(/testirc/)
    .expect(/Admin/)
    .expect(/adminnick/)
    .expect(/Internal/)
    .expect(/Paid/)
    .expect(/admin@regcfp/)
    .end(done);
  });

  describe('validation', function() {
    before('Login', function(done) {
      set_user(agent, 'validation-test@regcfp', done);
    });

    it('should ensure valid regfee', function(done) {
      agent.post('/registration/register')
      .send({'name': 'TestUser A'})
      .send({'field_ircnick': 'testirc'})
      .send({'regfee': '-10'})
      .expect(200)
      .expect(/Please choose a valid registration fee/)
      .end(done)
    })

    it('should preserve field values when redisplaying the form', function(done) {
      agent.post('/registration/register')
      .send({'name': 'TestUser A'})
      .send({'field_ircnick': 'testirc'})
      .expect(200)
      .expect(/Please choose a valid registration fee/)
      .expect(/name="name" value="TestUser A"/)
      .end(done);
    });
  });

  describe('booleans', function() {
    before('Login', function(done) {
      set_user(agent, 'booleans-test@regcfp', done);
    });

    function basic_reg() {
      return {
        'name': 'TestUser A',
        'regfee': '0',
        'currency': 'EUR',
        'field_ircnick': 'testirc'
      }
    }

    it('should set boolean option to true', function(done) {
      agent.post('/registration/register')
        .send(basic_reg())
        .send({'field_volunteer': 'any random string should evaluate to true!'})
        .expect(200)
        .then(function() {
      agent.get('/registration/register')
        .expect(/name="field_volunteer" checked="checked"/)
        .end(done);
      });
    });

    it('should set boolean option to false', function(done) {
      agent.post('/registration/register')
        // The browser sends no data for checkbox <input> fields if they
        // unchecked.
        .expect(200)
        .then(function() {
      agent.get('/registration/register')
        .expect(/name="field_volunteer"\s+>/)
        .end(done);
      });
    });
  });

  describe('inventory', function() {
    before('Login', function(done) {
      set_user(agent, 'inventory-test@regcfp', done);
    });

    it('shows items for purchase', function(done) {
      agent.get('/registration/register')
      .expect(200)
      .expect(/<input type="radio" class="purchase-option" name="field_room" value="1 night" data-cost="20" data-left="2"/)
      .expect(/<input type="radio" class="purchase-option" name="field_room" value="2 nights" data-cost="40" data-left="4"/)
      .end(done);
    });

    it('allows purchasing items', function(done) {
     agent.post('/registration/register')
      .send({'name': 'Purchaser 1'})
      .send({'field_ircnick': 'p1'})
      .send({'is_public': 'true'})
      .send({'currency': 'EUR'})
      .send({'field_room': '1 night'})
      .send({'regfee': '1'})
      .expect(200)
      .expect(/Thanks for registering/)
      .end(done);
    });

    it('updates inventory after purchase', function(done) {
      // We change users for this test, because users don't see the room they
      // bought themselves as taken.
      set_user(agent, 'inventory-test-2@regcfp', function() {
        agent.get('/registration/register')
        .expect(200)
        .expect(/<input type="radio" class="purchase-option" name="field_room" value="1 night" data-cost="20" data-left="1"/)
        .expect(/<input type="radio" class="purchase-option" name="field_room" value="2 nights" data-cost="40" data-left="4"/)
        .end(done);
      });
    });

    it('allows second purchase', function(done) {
     agent.post('/registration/register')
      .send({'name': 'Purchaser 2'})
      .send({'field_ircnick': 'p2'})
      .send({'is_public': 'true'})
      .send({'currency': 'EUR'})
      .send({'field_room': '1 night'})
      .send({'regfee': '1'})
      .expect(200)
      .expect(/Thanks for registering/)
      .end(done);
    });

    it('updates inventory again after purchase', function(done) {
      // We change users for this test, because users don't see the room they
      // bought themselves as taken.
      set_user(agent, 'inventory-test-3@regcfp', function() {
        agent.get('/registration/register')
        .expect(200)
        .expect(/<input type="radio" class="purchase-option" name="field_room" value="1 night" data-cost="20" data-left="0"/)
        .expect(/<input type="radio" class="purchase-option" name="field_room" value="2 nights" data-cost="40" data-left="4"/)
        .end(done);
      });
    });

    it('does not allow purchase after items are sold out', function(done) {
      set_user(agent, 'inventory-test-3@regcfp', function() {
       agent.post('/registration/register')
        .send({'name': 'Purchaser 3'})
        .send({'field_ircnick': 'p3'})
        .send({'is_public': 'true'})
        .send({'currency': 'EUR'})
        .send({'field_room': '1 night'})
        .send({'regfee': '1'})
        .expect(200)
        .expect(/Something went wrong: No more &#x27;1 night&#x27; purchases available for field: Accommodation booking./)
        .end(done);
      });
    });
  });
});
