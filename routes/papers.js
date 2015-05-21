var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Paper = models.Paper;
var PaperVote = models.PaperVote;

router.all('/submit', utils.require_user);
router.all('/submit', utils.require_permission('papers/submit'));
router.get('/submit', function(req, res, next) {
  res.render('papers/submit');
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

  if(paper.title.length > 50 ||
     paper.title == '' ||
     paper.summary == '')
  {
    res.render('papers/submit', {
      paper_title: paper.title,
      paper_summary: paper.summary,
      submission_error: true
    });
  } else {
    add_paper(req.user, paper, res);
  }
});

router.all('/list/own', utils.require_user);
router.all('/list/own', utils.require_permission('papers/list/own'));
router.get('/list/own', function(req, res, next) {
  req.user.getPapers().complete(function(err, papers) {
    res.render('papers/list', { description: 'Your',
                                papers: papers });
  });
});

router.all('/list', utils.require_permission('papers/list/accepted'));
router.get('/list', function(req, res, next) {
  Paper
    .findAll({
      where: {
        accepted: true
      }
    })
    .complete(function(err, papers) {
      res.render('papers/list', { description: 'Accepted',
                                  papers: papers });
    });
});

router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('papers/list/all'));
router.get('/admin/list', function(req, res, next) {
  Paper.findAll({include: [User, PaperVote]})
    .complete(function(err, papers) {
      res.render('papers/list', { description: 'All',
                                  showAuthors: true,
                                  showVotes: true,
                                  papers: papers });
    });
});

router.all('/admin/vote', utils.require_user);
router.all('/admin/vote', utils.require_permission('papers/vote'));
router.get('/admin/vote', function(req, res, next) {
  Paper.findAll({include: [User, PaperVote]})
    .complete(function(err, papers) {
      res.render('papers/vote', { papers: papers});
    });
});

router.post('/admin/vote', function(req, res, next) {
});

module.exports = router;
