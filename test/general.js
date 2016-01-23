var request = require('supertest');
var app = require('../app');

describe('general', function() {
  var agent = request.agent(app);

  it('should have a homepage', function(done) {
    agent.get('/')
    .expect(200)
    .expect(/Welcome to the event/)
    .end(done);
  });

  it('should have a 404', function(done) {
    agent.get('/non-existing')
    .expect(404)
    .expect(/Error: Not Found/)
    .end(done);
  });
});
