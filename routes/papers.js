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
      paper_info = [];
      for(paper in papers) {
        paper = papers[paper];
        ppr = {
          id: paper.id,
          title: paper.title,
          summary: paper.summary,
          User: paper.User
        };
        for(vote in paper.PaperVotes) {
          vote = paper.PaperVotes[vote];
          if(vote.UserId == req.user.id)
          {
            ppr.vote = {
              vote: vote.vote,
              comment: vote.comment,
              abstained: vote.abstained
            };
            if(ppr.vote.abstained) {
              ppr.vote.vote = null;
            }
          }
        }
        paper_info.push(ppr);
      }
      res.render('papers/vote', { papers: paper_info,
                                  voteOptions: [-2, -1, 0, 1, 2]});
    });
});

router.post('/admin/vote', function(req, res, next) {
  errors = [];
  saved = [];

  for(key in req.body) {
    if(key.substring(0, 5) == "vote_")
    {
      var id = key.substring(5);
      var vote_val = req.body[key];
      var abstained = false;
      if(vote_val == 'A')
      {
        abstained = true;
        vote_val = null;
      }
      var comment = req.body["comment_" + key];

      PaperVote.findOne({ where: {
        UserId: req.user.id,
        PaperId: id
      }}).then(function(vote) {
        if(vote == null) {
          console.log('NEW VOTE');
          PaperVote
            .create({
              comment: comment,
              vote: vote_val,
              abstained: abstained,
            })
            .complete(function(err, vote) {
              if(!!err) {
                errors.push({id: id, err: err});
              } else {
                Paper.findOne({where: {id: id}}).then(function(paper) {
                  paper.addPaperVote(vote);
                });
                req.user.addPaperVote(vote);
                saved.push(id);
              }
            });
        } else {
          console.log('Updating: ' + vote);
          vote.comment = comment;
          vote.vote = vote_val;
          vote.abstained = abstained;
          vote.save();
        }
      });
    }
  }
  res.render('papers/vote_submit', { errors: JSON.stringify(errors),
                                     saved: JSON.stringify(saved) });
});

module.exports = router;
