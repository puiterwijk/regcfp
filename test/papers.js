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

  before('submit test talk', function(done) {
    agent.post('/papers/submit')
    .send({'paper_title': 'Secret Talk'})
    .send({'paper_summary': 'Some Nonlisted summary'})
    .send({'track': 'security'})
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

  it('should allow to submit second talk', function(done) {
    agent.post('/papers/submit')
    .send({'paper_title': 'Second Talk'})
    .send({'paper_summary': 'Second summary'})
    .send({'track': 'data'})
    .expect(200)
    .expect(/Your paper was submitted, thank you!/)
    .end(done);
  });

  it('should list submitted talk', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Testing Talk/)
    .expect(/Second Talk/)
    .end(done);
  });

  it('should allow tag', function(done) {
    agent.post('/papers/tag')
    .send({'paper': '2'})
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

  it('should refuse adding copresenters for unknown talk', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '4'})
    .send({'email': 'usera@regcfp'})
    .expect(404)
    .end(done);
  });

  it('should refuse adding copresenters for other persons talk', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '1'})
    .send({'email': 'usera@regcfp'})
    .expect(403)
    .end(done);
  });

  it('should refuse adding presenter to copresenters', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '2'})
    .send({'email': 'usera@regcfp'})
    .expect(200)
    .expect(/is main presenter/)
    .end(done);
  });

  it('should refuse adding unregistered copresenters', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '2'})
    .send({'email': 'userc@regcfp'})
    .expect(200)
    .expect(/may not be registered/)
    .end(done);
  });

  it('should allow adding copresenters', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '2'})
    .send({'email': 'userb@regcfp'})
    .expect(200)
    .expect(/The copresenter was added/)
    .end(done);
  });

  it('should not allow the same copresenter twice', function(done) {
    agent.post('/papers/copresenter/add')
    .send({'paper': '2'})
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

  it('should show edit button', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Edit/)
    .end(done);
  });

  it('should should not allow to edit nonexisting paper', function(done) {
    agent.post('/papers/edit')
    .send({'paper': '4'})
    .send({'paper_title': ''})
    .send({'paper_summary': ''})
    .send({'track': 'security'})
    .expect(404)
    .end(done);
  });

  it('should should not allow to edit other persons paper', function(done) {
    agent.post('/papers/edit')
    .send({'paper': '1'})
    .send({'paper_title': ''})
    .send({'paper_summary': ''})
    .send({'track': 'security'})
    .expect(403)
    .end(done);
  });

  it('should handle empty forms on edit', function(done) {
    agent.post('/papers/edit')
    .send({'paper': '2'})
    .send({'paper_title': ''})
    .send({'paper_summary': ''})
    .send({'track': 'security'})
    .expect(200)
    .expect(/name="submitter_name" value="TestUser A"/)
    .expect(/value="usera@regcfp"/)
    .end(done);
  });

  it('should refuse talk title lenght >50 chars on edit', function(done) {
    agent.post('/papers/edit')
    .send({'paper': '2'})
    .send({'paper_title': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'})
    .send({'paper_summary': 'Some summary'})
    .send({'track': 'security'})
    .expect(200)
    .expect(/name="submitter_name" value="TestUser A"/)
    .expect(/value="usera@regcfp"/)
    .end(done);
  });

  it('should allow to edit a talk', function(done) {
    agent.post('/papers/edit')
    .send({'paper': '2'})
    .send({'paper_title': 'Updated Testing Talk'})
    .send({'paper_summary': 'Some New summary'})
    .send({'track': 'data'})
    .expect(200)
    .expect(/Your paper was submitted, thank you!/)
    .end(done);
  });

  it('should list updated talk', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Updated Testing Talk/)
    .expect(/New summary/)
    .end(done);
  });

  it('should show delete button', function(done) {
    agent.get('/papers/list/own')
    .expect(200)
    .expect(/Delete/)
    .end(done);
  });

  it('should should not allow to delete nonexisting paper', function(done) {
    agent.post('/papers/delete')
    .send({'paper': '4'})
    .expect(404)
    .end(done);
  });

  it('should should not allow to delete other persons paper', function(done) {
    agent.post('/papers/delete')
    .send({'paper': '1'})
    .expect(403)
    .end(done);
  });

  it('should allow to delete a talk', function(done) {
    agent.post('/papers/delete')
    .send({'paper': '2'})
    .expect(302)
    .expect('Location', '/papers/list/own')
    .end(done);
  });

  it('should have deleted the paper', function(done) {
    agent.post('/papers/delete')
    .send({'paper': '2'})
    .expect(404)
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

  it('should list all talks for admin', function(done) {
    agent.get('/papers/admin/list')
    .expect(200)
    .expect(/Secret Talk/)
    .expect(/Second Talk/)
    .end(done);
  });

  it('should list all talks for voting for admin', function(done) {
    agent.get('/papers/admin/vote')
    .expect(200)
    .expect(/Secret Talk/)
    .expect(/security/)
    .expect(/TestUser B/)
    .expect(/Second Talk/)
    .expect(/data/)
    .expect(/TestUser A/)
    .end(done);
  });

  it('should allow vote saving', function(done) {
    agent.post('/papers/admin/vote')
    .send({'vote_1': '1'})
    .send({'comment_vote_1': 'Some Comment'})
    .send({'vote_3': 'A'})
    .send({'comment_vote_3': 'Second Comment'})
    .expect(200)
    .expect(/Votes saved/)
    .expect(/Errors: \n<\/div>/)
    .end(done);
  });

  it('should list previous voting results', function(done) {
    agent.get('/papers/admin/vote')
    .expect(200)
    .expect(/Some Comment/)
    .expect(/Second Comment/)
    .expect(/checked/)
    .end(done);
  });

  it('should show voting results', function(done) {
    agent.get('/papers/admin/vote/show')
    .expect(200)
    .expect(/Some Comment/)
    .expect(/Second Comment/)
    .expect(/1 \(num: 1, total: 1\)/)
    // We cannot make an average from only abstainments
    .expect(/NaN \(num: 0, total: 0\)/)
    .expect(/none/)
    .expect(/yes/)
    .expect(/no/)
    .end(done);
  });

  it('should allow acceptance saving', function(done) {
    agent.post('/papers/admin/vote/show')
    .send({'accept_1': 'yes'})
    .send({'accept_3': 'no'})
    .expect(200)
    .expect(/Acceptances saved/)
    .expect(/Errors: \n<\/div>/)
    .end(done);
  });

  it('should list acceptances', function(done) {
    agent.get('/papers/admin/vote/show')
    .expect(200)
    .expect(/id="accept_1_yes"\n( )*selected="selected"/)
    .expect(/id="accept_3_no"\n( )*selected="selected"/)
    .end(done);
  });

  it('should list accepted talks', function(done) {
    agent.get('/papers/list')
    .expect(200)
    .expect(/Secret Talk/)
    .end(done);
  });

});
