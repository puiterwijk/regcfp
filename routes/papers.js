var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Paper = models.Paper;
var PaperVote = models.PaperVote;
var PaperTag = models.PaperTag;
var PaperCoPresenter = models.PaperCoPresenter;

var env       = process.env.NODE_ENV || "development";
var config = require('../config/config.json')[env];

router.all('/', utils.require_feature('papers'));

router.all('/submit', utils.require_user);
router.all('/submit', utils.require_permission('papers/submit'));
router.get('/submit', function(req, res, next) {
  res.render('papers/submit', { paper: {}, tracks: config['papers']['tracks'] });
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
    track: req.body.track.trim(),
    accepted: false
  };

  if(paper.title.length > 50 ||
     paper.title == '' ||
     paper.summary == '')
  {
    res.render('papers/submit', {
      paper: paper,
      tracks: config['papers']['tracks'],
      submission_error: true
    });
  } else {
    add_paper(req.user, paper, res);
  }
});

function get_paper_copresenters(res, papers, cb) {
  User.findAll()
  .complete(function(err, users) {
    if(!!err) {
      console.log('Error getting users: ' + err);
      res.status(500).send('Error getting users');
    } else {
      for(var paper in papers) {
        for(var copresenter in papers[paper].PaperCoPresenters) {
          for(var user in users) {
            user = users[user];
            if(papers[paper].PaperCoPresenters[copresenter].UserId == user.id) {
              papers[paper].PaperCoPresenters[copresenter] = user;
            }
          }
        }
      }
      cb(papers);
    }
  });
};

router.all('/list/own', utils.require_user);
router.all('/list/own', utils.require_permission('papers/list/own'));
router.get('/list/own', function(req, res, next) {
  req.user.getPapers({include: [PaperTag, PaperCoPresenter, User]}).complete(function(err, papers) {
    get_paper_copresenters(res, papers, function(papers_with_copresenters) {
      res.render('papers/list', { description: 'Your',
                                  showAuthors: true,
                                  papers: papers });
    });
  });
});

router.all('/list', utils.require_permission('papers/list/accepted'));
router.get('/list', function(req, res, next) {
  Paper
    .findAll({
      include: [PaperTag, PaperCoPresenter, User],
      where: {
        accepted: true
      }
    })
    .complete(function(err, papers) {
      get_paper_copresenters(res, papers, function(papers_with_copresenters) {
        res.render('papers/list', { description: 'Accepted',
                                    showAuthors: true,
                                    papers: papers });
      });
    });
});

router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('papers/list/all'));
router.get('/admin/list', function(req, res, next) {
  Paper.findAll({include: [User, PaperVote, PaperTag, PaperCoPresenter]})
    .complete(function(err, papers) {
      get_paper_copresenters(res, papers, function(papers_with_copresenters) {
        res.render('papers/list', { description: 'All',
                                    showAuthors: true,
                                    showVotes: true,
                                    papers: papers });
      });
    });
});

router.all('/admin/vote/show', utils.require_user);
router.all('/admin/vote/show', utils.require_permission('papers/showvotes'));
router.get('/admin/vote/show', function(req, res, next) {
  Paper.findAll({include: [User, PaperVote, PaperTag]})
    .complete(function(err, papers) {
      paper_info = [];
      for(paper in papers) {
        paper = papers[paper];
        ppr = {
          id: paper.id,
          title: paper.title,
          summary: paper.summary,
          User: paper.User,
          accepted: paper.accepted,
          vote_count: 0,
          vote_total: 0,
          votes: []
        };
        for(vote in paper.PaperVotes) {
          vote = paper.PaperVotes[vote];
          if(!vote.abstained) {
            ppr.vote_count++;
            ppr.vote_total += vote.vote;
          }
          ppr.votes.push({
            user: vote.UserId,
            vote: vote.vote,
            comment: vote.comment,
            abstained: vote.abstained
          });
        }
        ppr.vote_average = (ppr.vote_total / ppr.vote_count);
        paper_info.push(ppr);
      }
      paper_info = paper_info.sort(function(a, b) {
        return b.vote_average - a.vote_average;
      });
      res.render('papers/showvotes', { papers: paper_info });
    });
});

function save_accepts(keys, errors, req, res, next) {
  if(keys.length == 0) {
    res.render('papers/accept_submit', { errors: errors });
  } else {
    var key = keys[0];
    keys = keys.slice(1);
    if(key.substring(0, 7) == 'accept_') {
      var id = key.substring(7);
      console.log('Id: ' + id);
      var accepted = req.body[key];
      console.log('Accepted: ' + accepted);
      Paper.findOne({where: {
        id: id
      }}).then(function(paper) {
        if(accepted == 'no') {
          paper.accepted = false;
        } else {
          paper.accepted = true;
        }
        paper.save().complete(function(err, paper) {
          if(!!err) {
            errors.push({id: id, err: err});
          }
          save_accepts(keys, errors, req, res, next);
        });
      });
    }
  }
};

router.post('/admin/vote/show', utils.require_permission('papers/accept'));
router.post('/admin/vote/show', function(req, res, next) {
  save_accepts(Object.keys(req.body), [], req, res, next);
});

router.all('/admin/vote', utils.require_user);
router.all('/admin/vote', utils.require_permission('papers/vote'));
router.get('/admin/vote', function(req, res, next) {
  Paper.findAll({include: [User, PaperVote, PaperTag]})
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

function save_votes(keys, errors, req, res, next) {
  if(keys.length == 0) {
    res.render('papers/vote_submit', { errors: errors });
  } else {
    var key = keys[0];
    keys = keys.slice(1);
    if(key.substring(0, 5) == 'vote_') {
      var id = key.substring(5);
      console.log("Id: " + id);
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
          console.log('NEW VOTE for ' + id);
          PaperVote
            .create({
              comment: comment,
              vote: vote_val,
              abstained: abstained,
              PaperId: id,
              UserId: req.user.id,
            })
            .complete(function(err, vote) {
              if(!!err) {
                console.log("ERRORS: " + err);
                errors.push({id: id, err: err, phase: "addVote"});
              }
              save_votes(keys, errors, req, res, next);
            });
        } else {
          console.log('Updating: ' + vote);
          vote.comment = comment;
          vote.vote = vote_val;
          vote.abstained = abstained;
          vote.save().complete(function(err, vote) {
            if(!!err) {
              errors.push({id: id, err: err});
            };
            save_votes(keys, errors, req, res, next);
          });
        }
      });
    } else {
      // Continue directly with one less entry in the list
      save_votes(keys, errors, req, res, next);
    }
  }
}

router.post('/admin/vote', function(req, res, next) {
  save_votes(Object.keys(req.body), [], req, res, next);
});

router.all('/tag', utils.require_permission('papers/tag'));
router.post('/tag', function(req, res, next) {
  var info = {
    PaperId: req.body.paper,
    tag: req.body.tag.trim()
  };
  PaperTag
    .create(info)
    .complete(function(err, paper) {
      if(!!err) {
        console.log('Error saving paper ta: ' + err);
        res.status(500).send('Error saving paper tag');
      } else {
        res.render('papers/tag_success');
      }
    });
});

function already_copresenter(paper, copresenter) {
  for(var user in paper.PaperCoPresenters) {
    user = paper.PaperCoPresenters[user];
    if(copresenter.id == user.id) {
      return true;
    }
  }
  return false;
}

router.post('/copresenter/add', function(req, res, next) {
  Paper.findOne({where: {id: req.body.paper}, include: [PaperCoPresenter, User]})
    .then(function(paper) {
      User.findOne({where: {email: req.body.email}})
        .then(function(copresenter) {
          if(!copresenter || !paper) {
            res.render('papers/copresenter_add_failed', { reason: 'Email invalid'});
          } else if(copresenter.id == paper.User.id) {
            res.render('papers/copresenter_add_failed', { reason: 'Copresenter is main presenter' });
          } else if(already_copresenter(paper, copresenter)) {
            res.render('papers/copresenter_add_failed', { reason: 'Copresenter is already registered' });
          } else {
            var info = {
              PaperId: paper.id,
              UserId: copresenter.id
            };
            PaperCoPresenter
              .create(info)
              .complete(function(err, copresenter) {
                if(!!err) {
                  console.log('Error adding copresenter: ' + err);
                  res.status(500).send('Error adding copresenter');
                } else {
                  res.render('papers/copresenter_added');
                }
            });
          }
        });
  });
});

module.exports = router;
