var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Paper = models.Paper;

router.all('/submit', utils.require_permission('papers/submit'));
router.get('/submit', function(req, res, next) {
  User
    .find({
      where: {
        email: req.session.currentUser
      }
    })
    .complete(function(err, user) {
      console.log('User: ' + user);
      if(!!err) {
        console.log('Error searching for user: ' + err);
        res.status(500).send('Error retrieving user object');
      } else if(!user) {
        res.render('papers/submit', { });
      } else {
        res.render('papers/submit', { submitter_name: user.name, submitter_name_found: true });
      }
    });
});

function add_paper(user, paper, res) {
  Paper
    .create(paper)
    .complete(function(err, paper) {
      if(!!err) {
        console.log('Error saving paper: ' + err);
        res.status(500).send('Error saving paper submission');
      } else {
        user.addPaper(paper)
          .complete(function(err) {
            if(!!err) {
              console.log('Error attaching paper to user: ' + err);
              res.status(500).send('Error attaching your paper to your user');
            } else {
              res.render('papers/submit_success');
            }
          });
      }
    });
}

router.post('/submit', function(req, res, next) {
  var paper = {
    title: req.body.paper_title.trim(),
    summary: req.body.paper_summary.trim(),
    accepted: false
  };

  User
    .find({
      where: {
        email: req.session.currentUser
      }
    })
    .complete(function(err, user) {
      if((user == null && req.body.submitter_name.trim() == '') ||
         paper.title.length > 50 ||
         paper.title == '' ||
         paper.summary == '')
      {
        res.render('papers/submit', {
          submitter_name: (user != null && user.name) || req.body.submitter_name,
          submitter_name_found: user != null,
          paper_title: paper.title,
          paper_summary: paper.summary,
          submission_error: true
        });
      } else {
        if(!!err) {
          console.log('Error searching for user: ' + err);
          res.status(500).send('Error retrieving user object');
        } else if(!user) {
            // Create new user
            var submitter_name = req.body.submitter_name;
            
            var user = User.create({
              email: req.session.currentUser,
              name: submitter_name
            }).complete(function(err, user) {
              add_paper(user, paper, res);
            });
        } else {
          add_paper(user, paper, res);
        }
      }
    });
});

router.all('/list/own', utils.require_permission('papers/list/own'));
router.get('/list/own', function(req, res, next) {
  User
    .find({
      where: {
        email: req.session.currentUser
      }
    })
    .complete(function(err, user) {
      if(!!err) {
        console.log('Error searching for user: ' + err);
        res.status(500).send('Error retrieving user object');
      } else if(!user) {
        res.render('papers/list', { papers: [] });
      } else {
        user.getPapers().complete(function(err, papers) {
          res.render('papers/list', { description: 'Your',
                                      papers: papers });
        });
      }
    });
});

router.all('/list', utils.require_permission('papers/list/accepted'));
router.get('/list', function(req, res, next) {
  Paper
    .find({
      where: {
        accepted: true
      }
    })
    .complete(function(err, papers) {
      res.render('papers/list', { description: 'Accepted',
                                  papers: papers });
    });
});

router.all('/admin/list', utils.require_permission('papers/list/all'));
router.get('/admin/list', function(req, res, next) {
  Paper.find()
    .complete(function(err, papers) {
      res.render('papers/list', { description: 'All',
                                  papers: papers });
    });
});

module.exports = router;
