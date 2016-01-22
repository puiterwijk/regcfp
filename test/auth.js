var request = require('supertest');
var app = require('../app');

function getCookie(res) {
  return res.headers['set-cookie'][0].split(';')[0];
}

describe('auth', function() {
  describe('POST /login', function() {
    it('Should send 401 on invalid', function(done) {
      request(app)
        .post('/auth/login')
        .expect(401, done);
    });
  });
});
