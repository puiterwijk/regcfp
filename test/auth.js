var request = require('supertest');
var app = require('../app');

describe('auth', function() {
  var agent = request.agent(app);

  before('Make sure all tables exist', function(done) {
    app.db.sequelize.sync({force: true})
    .then(function() {
      done();
    });
  });

  it('should start logged out', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/please login/)
    .end(done);
  });

  it('should refuse get on auth', function(done) {
    agent.get('/auth/login')
    .expect(401)
    .end(done);
  });

  it('should refuse access if require_login', function(done) {
    agent.get('/authg/register')
    .expect(401)
    .expect(/Required: Login/)
    .end(done);
  });

  it('should refuse access if require_user', function(done) {
    agent.get('/registration/receipt')
    .expect(401)
    .expect(/Required: Login/)
    .end(done);
  });

  it('should welcome the user', function(done) {
    agent.post('/auth/login')
    .send({'email': 'usera@regcfp'})
    .expect(200)
    .expect('Welcome usera@regcfp')
    .end(done);
  });

  it('should tell the user is logged in', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/Welcome, usera@regcfp/)
    .end(done);
  });

  it('should redirect user to register', function(done) {
    agent.get('/papers/submit')
    .expect(302)
    .expect('Location', '/authg/register?origin=/papers/submit')
    .end(done);
  });

  it('should show register form', function(done) {
    agent.get('/authg/register?origin=/papers/submit')
    .expect(200)
    .expect(/some additional information/)
    .end(done);
  });

  it('should refuse empty name', function(done) {
    agent.post('/authg/register')
    .send({'origin': '/papers/submit'})
    .send({'fullname': ''})
    .expect(302)
    .expect('Location', '/authg/register?origin=/papers/submit')
    .end(done);
  });

  it('should handle empty origin', function(done) {
    agent.post('/authg/register')
    .send({'fullname': ''})
    .expect(302)
    .expect('Location', '/authg/register?origin=/')
    .end(done);
  });

  it('should register correctly', function(done) {
    agent.post('/authg/register')
    .send({'origin': '/papers/submit'})
    .send({'fullname': 'TestUser A'})
    .expect(302)
    .expect('Location', '/papers/submit')
    .end(done);
  });

  it('should not do covert redirects', function(done) {
    agent.post('/authg/register')
    .send({'origin': 'https://fedoraproject.org/'})
    .send({'fullname': 'Some User'})
    .expect(302)
    .expect('Location', '/')
    .end(done);
  });

  it('should show the user name', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/Welcome, TestUser A/)
    .end(done);
  });

  it('should not allow desk access', function(done) {
    agent.get('/desk')
    .expect(401)
    .expect(/No permissions/)
    .end(done);
  });

  it('should allow logout', function(done) {
    agent.post('/auth/logout')
    .expect(200)
    .expect('Logged out')
    .end(done);
  });

  it('should tell the user is logged out', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/please login/)
    .end(done);
  });
});
