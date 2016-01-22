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
    .send({'is_public': 'true'})
    .expect(200)
    .expect(/Thanks for registering/)
    .end(done);
  });
});
