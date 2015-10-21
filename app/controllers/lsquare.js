var Lsquare = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Lsquare = require('../models/lsquare').Lsquare;
  var LsquareAnswer = require('../models/lsquareAnswers').LsquareAnswers;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var jwt = require('jsonwebtoken');


  var imagick = require('imagemagick');
  
  this.params = {};
  var self = this;
  var fs = require('fs');
  var path = require('path');

  this.params = {};
  this.config = require('../config/config.js');
  var self = this;

  this.getLsquare = function(req, res){
    //self.params = JSON.parse(req.query.params);    
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
        'question' : 1,
        'description' : 1,
        'url_slug' : 1,                
        'tags' : 1,
        'views' : 1,
        'createdAt' : 1,
        'active' : 1,
        'createdBy' : 1,
        'answers' : 1
      };

      query.match.active = 1;
      //query.match.toolId = self.toolId;
      return query;
    };

    self.sortFilteredMedia = function(query, callback){      
      var data = [];
      var user = []; 
      async.parallel({
        count : function(callbackInner)
        {          
          Lsquare.aggregate(
            {$match : query.match},
            {$group: { _id : "url_slug", count: {$sum: 1} }},
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
            //case 'score': query.sortBy = { 'score' : -1}; break;
          }
          query.sortBy._id = 1;
          Lsquare.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              var questionUserIds = [];
              for(i in results) { questionUserIds.push(results[i].createdBy); }
              CommonLib.getUserInfo(questionUserIds, function(err, userInfo){
                for(i in results) results[i].createdBy = userInfo[results[i].createdBy];
                callbackInner(err, results);                  
              });                  
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

            question.createdBy = decoded._id;
            question.url_slug = url;
            question.question = req.body.question;
            question.description = req.body.description;          
            question.tags = req.body.tags;
            question.createdAt = Date();
            question.editedAt = Date();
            question.views = 0;
            question.active = 1; 
            //return  res.status(200).json(question);
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
          answer = req.body.answer;
            var newAnswer = Lsquare(answer);
            Lsquare.findOneAndUpdate({_id: req.body.answer._id}, newAnswer, {upsert:true}, function(err, doc){
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
          var newAnswer = {};
          newAnswer.answeredBy = req.body.userId;
          newAnswer.answer = req.body.answer;
          newAnswer.description = req.body.description;
          newAnswer.id = questionID;        

          Lsquare.findOneAndUpdate({_id: answer.id}, answer, {upsert:true}, function(err, doc){
            if (err) return res.send(500, { error: err });
            return res.status(200).json("succesfully updated");
          });
        }
    });
  };

  this.show = function(req, res){
    Lsquare.findOne({url_slug: req.params.urlSlug}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      res.status(200).json({lsquare : results});
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      urlSlug: req.params.urlSlug,
      type: 'lsquare',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  };

  this.dataImport = function(req, res){ 
  
    // //........Insert Questions  
    // var path = 'public/bestRate/lsqaure_Question.json';
    // var obj = JSON.parse(fs.readFileSync(path, 'utf8'));

    // for(i in obj){
    //   var data = obj[i];
    //   data['oldId'] = parseInt(data['oldId']);     
    //   var newLsquare = Lsquare(obj[i]);
    //   //return res.status(200).json(newLsquare);           
    //       // save the Media
    //       newLsquare.save(function(err) {
    //         if(err) return res.status(500).json(err);  
    //         return res.status(200).json(newLsquare._id);
    //       });
    // }

    //........Insert answers  
    var path = 'public/bestRate/answers_list.json';
    var obj = JSON.parse(fs.readFileSync(path, 'utf8'));
    //return res.status(200).json(obj.length);
    obj = obj.reverse();
    var iD;

    for(i in obj){
      var ID = obj[i].oldQuestionID
      var data = obj[i];      
      Lsquare.findOne({oldId : ID}).lean().exec(function(err, question){        
        if(question){
        iD = question._id;}

        var newLsquare = LsquareAnswer(data);
        return res.status(200).json({data : data, obj: obj[i], ID:question});
        // save the Media
          newLsquare.save(function(err) {
            if(err) return res.status(500).json(err);  
            return res.status(200).json(newLsquare._id);
          });
        //return res.status(200).json(data);        
      });

          
      // var newLsquare = Lsquare(obj[i]);
      // //return res.status(200).json(newLsquare);           
          
    }

    // console.log(obj.length);

  };  
};

module.exports.Lsquare = Lsquare;