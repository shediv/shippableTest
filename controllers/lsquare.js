var Lsquare = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "digital";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getLsquare = function(req, res){
    //self.params = JSON.parse(req.query.params);
    res.status(200).json("result");
    async.waterfall([
      function(callback)
      {
        callback(null, self.applyFilters());
      },
      function(query, callback)
      {
        self.sortFilteredMedia(query, callback);
      }
    ],
    function (err, result)
    {
      if(err) return res.status(500).json(err);
      res.status(200).json(result);
    });
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};

      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'name' : 1,
        'answer' : 1,
        'createdBy' : 1
      };

      query.match.isActive = 1;
      //query.match.toolId = self.toolId;
      return query;
    };

    self.sortFilteredMedia = function(query, callback){
      var data = []; 
      async.parallel({
        count : function(callbackInner)
        {          
          Media.aggregate(
            {$match : query.match},
            {$group: { _id : null, count: {$sum: 1} }},
            function(err, result)
            {
              if(result[0] === undefined) count = 0;
              else count = result[0].count;
              callbackInner(err, count);
            }
          );
        },
        questions : function(callbackInner)
        { 
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
            case 'score': query.sortBy = { 'score' : -1}; break;
          }
          query.sortBy._id = 1;
          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              var questionUserIds = [];
              for(i in results) { questionUserIds.push(results[i].userId); }
              CommonLib.getUserInfo(questionUserIds, function(err, userInfo){
                for(i in results)
                  results[i].aksedBy = userInfo[results[i].aksedBy];
                callbackInner(err, results);
              });                  

               callbackInner(err, results);
            }
          );
        }
      },
      function(err, results) 
      {        
        callback(err, results);
      });
    };

  this.getFilters = function(req, res){
    async.parallel({
      trendingQuestions : self.getTrendingQuestions,
      topTags : self.getTopTags
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getTrendingQuestions = function(callback){
      Media.aggregate(
        {$match: {isActive : 1}},
        {$sort: {"score": -1, "views": -1}},
        function(error, results) 
        {
          for(i in results) {
            results['noOfAnswers'] = results[i].answer.length; 
          }

          var userIds = [];
          results.map(function(o){ userIds.push(o.userId); });

          callback(error, results);
        }
      );
    };

    self.getTopTags = function(callback){
        Media.aggregate(
          {$match: {isActive : 1}},
          {$sort: {"score": -1, "views": -1} },        
          function(error, results) 
          {
            var questionIds = [];
            results.map(function(o){ questionIds.push(o._id); });
            Category.find({_id : {$in: questionIds}},'name').lean().exec(function(err, tags){
              callback(error, tags);
            });
          }
        );
    };

  this.addQuestion = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else {
          var question = {};
          var url = req.body.question;
          // convert spaces to '-'
          url = url.replace(/ /g, "-");
          // Make lowercase
          url = url.toLowerCase();
          // Remove characters that are not alphanumeric or a '-'
          url = url.replace(/[^a-z0-9-]/g, "");
          // Combine multiple dashes (i.e., '---') into one dash '-'.
          url = url.replace(/[-]+/g, "-");

          question.aksedBy = req.body.userId;
          question.url = url;
          question.title = req.body.question;
          question.description = req.body.description;
          question.title = req.body.title;
          question.tags = req.body.tags;  

          var newQuestion = Lsquare(question);

          newQuestion.save(function(err){
            if(err) return res.status(500).json(err);
            res.status(200).json({newQuestion:newQuestion._id});
          });
        }      
    });
  };

  this.addAnswer = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else {
          var answer = {};
          answer.answeredBy = req.body.userId;
          answer.answer = req.body.answer;
          answer.description = req.body.description;
          answer.id = questionID;        

          Lsquare.findOneAndUpdate({_id: answer.id}, answer, {upsert:true}, function(err, doc){
            if (err) return res.send(500, { error: err });
            return res.status(200).json("succesfully updated");
          });
        }
    });
  };  

  this.upvoteAnswer = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else {
          var answer = {};
          answer.answeredBy = req.body.userId;
          answer.answer = req.body.answer;
          answer.description = req.body.description;
          answer.id = questionID;        

          Lsquare.findOneAndUpdate({_id: answer.id}, answer, {upsert:true}, function(err, doc){
            if (err) return res.send(500, { error: err });
            return res.status(200).json("succesfully updated");
          });
        }
    });
  };

  this.show = function(req, res){
    Lsquare.findOne({urlSlug: req.params.urlSlug}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      res.status(200).json({lsquare : results});
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.connection.remoteAddress,
      urlSlug: req.params.urlSlug,
      type: 'lsquare',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  };
};

module.exports.Lsquare = Lsquare;