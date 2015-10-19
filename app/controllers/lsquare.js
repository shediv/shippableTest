var Lsquare = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var Lsquare = require('../models/lsquare').Lsquare;
  var jwt = require('jsonwebtoken');
  var fs = require('fs');
  var imagick = require('imagemagick');
  
  this.params = {};
  this.config = require('../config/config.js');
  var self = this;

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

          question.askedBy = req.body.userId;
          question.url = req.body.url;
          question.title = req.body.question;
          question.description = req.body.description;          
          question.tags = req.body.tags;
          question.createdAt = Date();
          question.editedAt = Date();

          //Image upload
          var sourcePath = req.file.path;
          var extension = req.file.originalname.split(".");
          extension = extension[extension.length - 1];
          var destPath = "/images/lsquare/"+question.askedBy+"/"+req.body.url+"."+extension;
          var source = fs.createReadStream(sourcePath);
          var dest = fs.createWriteStream('./public'+destPath);
          source.pipe(dest);
          
          source.on('end', function(){
            imagick.resize({
            srcPath: './public'+destPath,
            dstPath: "./public/images/lsquare/"+question.askedBy+"/"+req.body.url+"."+extension,
            width: 200
          },
          function(err, stdout, stderr)
          {
            if(err) throw err;
            fs.writeFileSync("./public/images/lsquare/"+question.askedBy+"/"+req.body.url+"."+extension, stdout, 'binary');
            console.log('resized image to fit within 200x200px');
            fs.unlinkSync(sourcePath);

            question.image = destPath;

            var newQuestion = Lsquare(question);
            newQuestion.save(function(err){
              if(err) return res.status(500).json(err);
              res.status(200).json({newQuestion:newQuestion._id});
            });          
          });          
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
          answer.createdAt = Date();
          answer.editedAt = Date();

          //Image upload
          var sourcePath = req.file.path;
          var extension = req.file.originalname.split(".");
          extension = extension[extension.length - 1];
          var destPath = "/images/lsquare/"+userId+"/"+req.body.url+"."+extension;
          var source = fs.createReadStream(sourcePath);
          var dest = fs.createWriteStream('./public'+destPath);
          source.pipe(dest);

          source.on('end', function(){
            imagick.resize({
            srcPath: './public'+destPath,
            dstPath: "./public/images/lsquare/"+userId+"/"+req.body.url+"."+extension,
            width: 200
          },
          function(err, stdout, stderr)
          {
            if(err) throw err;
            fs.writeFileSync("./public/images/lsquare/"+userId+"/"+req.body.url+"."+extension, stdout, 'binary');
            console.log('resized image to fit within 200x200px');
            fs.unlinkSync(sourcePath);

            answer.image = destPath;

            var newQuestion = Lsquare(question);
            Lsquare.findOneAndUpdate({_id: req.body.id}, answer, {upsert:true}, function(err, doc){
              if (err) return res.send(500, { error: err });
              return res.status(200).json("succesfully updated");
            });          
          });          
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
    Lsquare.findOne({urlSlug: req.params.urlSlug}).lean().exec(function(err, results){
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
};

module.exports.Lsquare = Lsquare;