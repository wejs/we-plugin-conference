var assert = require('assert');
var request = require('supertest');
var helpers = require('we-test-tools').helpers;
var stubs = require('we-test-tools').stubs;
var stubs = require('we-test-tools').stubs;
var http;
var we;
var agent;

function cfnewsStub(salvedImageId){
  return {
    title: 'one test title',
    text: 'one test text',
    featuredImage: [ 'null', salvedImageId]
  };
}


describe('cfnewsFeature', function() {
  var salvedUser, salvedUserPassword, authenticatedRequest;
  var salvedConference, salvedImage;

  before(function (done) {
    http = helpers.getHttp();
    agent = request.agent(http);
    we = helpers.getWe();
    we.config.acl.disabled = true;

    we.utils.async.series([
      function createAuthenticatedUser(done) {
        var userStub = stubs.userStub();
        helpers.createUser(userStub, function(err, user) {
          if (err) throw err;
          salvedUser = user;
          salvedUserPassword = userStub.password;
          // login user and save the browser
          authenticatedRequest = request.agent(http);
          authenticatedRequest.post('/login')
          .set('Accept', 'application/json')
          .send({
            email: salvedUser.email,
            password: salvedUserPassword
          })
          .expect(200)
          .set('Accept', 'application/json')
          .end(done);
        });
      },
      function createImage(done) {
        // upload one stub image:
        request(http)
        .post('/api/v1/image')
        .attach('image', stubs.getImageFilePath())
        .end(function (err, res) {
          if(err) throw err;
          salvedImage = res.body.image[0];
          done(err);
        });
      },
      function createConference(done) {
        var cf = stubs.eventStub();
        we.db.models.event.create(cf)
        .then(function (scf) {
          salvedConference = scf;
          done();
        }).catch(done);
      }
    ], done);
  });

  describe('cfnewsCRUD', function() {
    it ('post /event/:eventId/cfnews/create should create one cfnews', function (done) {
      var cf = {
        title: 'one test title',
        text: 'one test text',
        featuredImage: [ 'null', salvedImage.id ]
      }
      authenticatedRequest
      .post('/event/'+salvedConference.id+'/cfnews/create')
      .send(cf)
      .set('Accept', 'application/json')
      .expect(201)
      .end(function (err, res) {
        if (err) throw err;
        assert(res.body.cfnews);
        assert(res.body.cfnews[0]);
        assert(res.body.cfnews[0].id);
        assert.equal(res.body.cfnews[0].title, cf.title);

        done();
      });
    });

    it ('get /event/:eventId/admin/news should get news list', function (done) {
      var cfrts = [
        cfnewsStub(salvedImage.id),
        cfnewsStub(salvedImage.id),
        cfnewsStub(salvedImage.id)
      ];
      we.db.models.cfnews.bulkCreate(cfrts)
      .then(function () {

        authenticatedRequest
        .get('/event/' + salvedConference.id + '/admin/news')
        .set('Accept', 'application/json')
        .expect(200)
        .end(function (err, res) {
          if (err) throw err;
          assert(res.body.cfnews);
          assert(res.body.cfnews.length >= 3);
          done();
        });
      }).catch(done);
    });
  });
});