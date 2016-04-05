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

  it('should allow registration', function(done) {
    agent.post('/registration/register')
    .send({'name': 'TestUser A'})
    .send({'field_ircnick': 'testirc'})
    .send({'is_public': 'true'})
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
    .send({'is_public': 'false'})
    .expect(200)
    .expect(/Your registration was updated, thank you/)
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

  it('should list all info for admin', function(done) {
    agent.get('/registration/admin/list')
    .expect(200)
    .expect(/TestUser A/)
    .expect(/testirc/)
    .end(done)
  });


});
