var request = require('supertest');
var app = require('../app');

describe('papers', function() {
  var agent = request.agent(app);

  before('Make sure all tables exist', function(done) {
    app.db.sequelize.sync({force: true})
    .then(function() {
      done();
    });
  });

  before('create second user', function(done) {
    agent.post('/auth/login')
    .send({'email': 'userb@regcfp'})
    .end(done);
  });

  before('register second user', function(done) {
    agent.post('/authg/register')
    .send({'origin': '/papers/submit'})
    .send({'fullname': 'TestUser B'})
    .end(done);
  });

  before('logout second user', function(done) {
    agent.post('/auth/logout')
    .expect(200)
    .expect('Logged out')
    .end(done);
  });

  it('should refuse access to papers submission', function(done) {
    agent.get('/papers/submit')
    .expect(401)
    .end(done);
  });

  it('should refuse access to post papers submission', function(done) {
    agent.post('/papers/submit')
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

  it('should require intermediate registration', function(done) {
    agent.get('/papers/submit')
    .expect(302)
    .expect('Location', '/authg/register?origin=/papers/submit')
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

  it('should show empty list', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Your submitted papers:<br \/><br \/>\n\n<\/div>/)
    .end(done);
  });

  it('should show name on papers submission', function(done) {
    agent.get('/papers/submit')
    .expect(200)
    .expect(/name="submitter_name" value="TestUser A"/)
    .expect(/value="usera@regcfp"/)
    .end(done);
  });

  it('should handle empty forms', function(done) {
    agent.post('/papers/submit')
    .send({'paper_title': ''})
    .send({'paper_summary': ''})
    .send({'track': 'security'})
    .expect(200)
    .expect(/name="submitter_name" value="TestUser A"/)
    .expect(/value="usera@regcfp"/)
    .end(done);
  });

  it('should refuse talk title lenght >50 chars', function(done) {
    agent.post('/papers/submit')
    .send({'paper_title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'})
    .send({'paper_summary': 'Some summary'})
    .send({'track': 'security'})
    .expect(200)
    .expect(/name="submitter_name" value="TestUser A"/)
    .expect(/value="usera@regcfp"/)
    .end(done);
  });

  it('should allow to submit talk', function(done) {
    agent.post('/papers/submit')
    .send({'paper_title': 'Testing Talk'})
    .send({'paper_summary': 'Some summary'})
    .send({'track': 'security'})
    .expect(200)
    .expect(/Your paper was submitted, thank you!/)
    .end(done);
  });

  it('should list submitted talk', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Testing Talk/)
    .end(done);
  });

  it('should allow tag', function(done) {
    agent.post('/papers/tag')
    .send({'paper': '1'})
    .send({'tag': 'Testing Tag'})
    .expect(200)
    .expect(/Your paper tag was added, thank you!/)
    .end(done);
  });

  it('should list tags', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Testing Tag/)
    .end(done);
  });

  it('should refuse adding presenter to copresenters', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '1'})
    .send({'email': 'usera@regcfp'})
    .expect(200)
    .expect(/is main presenter/)
    .end(done);
  });

  it('should refuse adding unregistered copresenters', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '1'})
    .send({'email': 'userc@regcfp'})
    .expect(200)
    .expect(/may not be registered/)
    .end(done);
  });

  it('should allow adding copresenters', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '1'})
    .send({'email': 'userb@regcfp'})
    .expect(200)
    .expect(/The copresenter was added/)
    .end(done);
  });

  it('should not allow the same copresenter twice', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '1'})
    .send({'email': 'userb@regcfp'})
    .expect(200)
    .expect(/copresenter has already been added/)
    .end(done);
  });

  it('should list copresenters', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/TestUser B/)
    .end(done);
  });


});
