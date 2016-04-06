var request = require('supertest');
var app = require('../app');

describe('registration', function() {
  var agent = request.agent(app);

  before('Make sure all tables exist', function(done) {
    app.db.sequelize.sync({force: true})
    .then(function() {
      done();
    });
  });

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

  it('should show registration form', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(/name="name" value=""/)
    .expect(/Hide my name/)
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

  it('should ask amount', function(done) {
    agent.post('/registration/register')
    .send({'name': 'TestUser A'})
    .send({'field_ircnick': 'testirc'})
    .send({'is_public': 'true'})
    .expect(200)
    .expect(/name="name" value=""/)
    .expect(/Please make sure you have filled all required fields./)
    .end(done);
  });

  it('should allow registration', function(done) {
    agent.post('/registration/register')
    .send({'name': 'TestUser A'})
    .send({'field_ircnick': 'testirc'})
    .send({'is_public': 'true'})
    .send({'currency': 'EUR'})
    .send({'regfee': '0'})
    .expect(200)
    .expect(/Thanks for registering/)
    .end(done);
  });

  it('should list registrations', function(done) {
    agent.get('/registration/list')
    .expect(200)
    .expect(/TestUser A/)
    .end(done)
  });

  it('should show filled in registration form', function(done) {
    agent.get('/registration/register')
    .expect(200)
    .expect(/name="name" value="TestUser A"/)
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

  it('should show the amount to pay before receipt', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/Not enough paid/)
    .expect(/20/)
    .end(done);
  });

  it('should show the payment form', function(done) {
    agent.get('/registration/pay')
    .expect(200)
    .expect(/Amount/)
    .end(done);
  });

  it('should show payment form on blank', function(done) {
    agent.post('/registration/pay')
    .expect(200)
    .expect(/Amount/)
    .end(done);
  });

  it('should show payment choice', function(done) {
    agent.post('/registration/pay')
    .send({'currency': 'EUR'})
    .send({'regfee': '10'})
    .expect(200)
    .expect(/paypal/)
    .expect(/onsite/)
    .end(done);
  });

  it('should mark zero as onsite payment', function(done) {
    agent.post('/registration/pay/do')
    .send({'currency': 'EUR'})
    .send({'regfee': '0'})
    // Default is onsite, let's test that default
    //.send({'method': 'onsite'})
    .expect(200)
    .expect(/asked to pay for your registration/)
    .end(done);
  });

  it('should refuse non-zero payment', function(done) {
    agent.post('/registration/pay/do')
    .send({'currency': 'EUR'})
    .send({'regfee': '10'})
    .expect(402)
    .end(done);
  });

  it('should accept non-zero onsite payment', function(done) {
    agent.post('/registration/pay/do')
    .send({'currency': 'EUR'})
    .send({'regfee': '10'})
    .send({'method': 'onsite'})
    .expect(200)
    .expect(/asked to pay for your registration/)
    .end(done);
  });

  it('should show the amount to pay before receipt', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/Not enough paid/)
    .expect(/onsite payment: €10/)
    .end(done);
  });

  it('should accept second non-zero onsite payment', function(done) {
    agent.post('/registration/pay/do')
    .send({'currency': 'EUR'})
    .send({'regfee': '10'})
    .send({'method': 'onsite'})
    .expect(200)
    .expect(/asked to pay for your registration/)
    .end(done);
  });

  it('should show the updated amount to pay before receipt', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/Not enough paid/)
    .expect(/onsite payment: €20/)
    .end(done);
  });

  it('should no longer list user', function(done) {
    agent.get('/registration/list')
    .expect(200)
    .expect(/<\/tr>\n<\/table>/)
    .end(done)
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
    .send({'is_public': 'true'})
    .send({'currency': 'EUR'})
    .send({'regfee': '0'})
    .expect(200)
    .expect(/Thanks for registering/)
    .end(done);
  });

  it('should list all info for admin', function(done) {
    agent.get('/registration/admin/list')
    .expect(200)
    .expect(/TestUser A/)
    .expect(/testirc/)
    .expect(/Admin/)
    .expect(/adminnick/)
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

  it('should detect desk receipt requirement', function(done) {
    agent.get('/desk/receipt/?regid=2')
    .expect(401)
    .expect(/Not enough paid for receipt/)
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

  it('should detect receipt requirement', function(done) {
    agent.get('/registration/receipt')
    .expect(401)
    .expect(/Not enough paid for receipt/)
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
    .expect(/The user did not pay enough for a receipt/)
    .expect(/Click here to print badge/)
    .end(done);
  });

  it('should print badge', function(done) {
    agent.get('/desk/badge?regida=1&regidb=2')
    .expect(200)
    .expect(/%PDF-1.4/)
    .end(done);
  });

});
