var Cafe = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var User = require('../models/user').User;
  var Cafe = require('../models/cafe').Cafe;
  var underscore = require('underscore');
  var jwt = require('jsonwebtoken');
  
  this.params = {};
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
  var self = this;

  this.store = function(req, res){
    Cafe.findOne({ url:req.body.cafe.url }).lean().exec(function(err, cafe){
      if(cafe) return res.status(500).json("Cafe already exists");

      var newUrl = req.body.cafe.url;
      // create a new Media
      if(newUrl.search('https://') > -1){
        req.body.cafe.baseUrl = (req.body.cafe.url).replace('https://','').split('/')[0];
      }else{
        req.body.cafe.baseUrl = (req.body.cafe.url).replace('http://','').split('/')[0];
      }
      
      //req.body.cafe.baseUrl = (req.body.cafe.url).replace('https://','').split('/')[0];
      req.body.cafe.createdAt = new Date();
      if(req.body.cafe.isFeatured == undefined) req.body.cafe.isFeatured = false;
      req.body.cafe.type = 'Link';

      var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, user){
          req.body.cafe.userId = user._id;
          var newCafe = Cafe(req.body.cafe);           
          // save the Media
          newCafe.save(function(err) {
            if(err) return res.status(500).json(err);
            res.status(200).json("Cafe Created Successfully");
          });  
      });    
    });
  };

  this.createPost = function(req, res){
    Cafe.findOne({ title:req.body.cafe.title }).lean().exec(function(err, cafe){
      if(cafe) return res.status(500).json("Cafe Post already exists");

      var newUrl = req.body.cafe.title;
      newUrl = newUrl.replace(/ /g, "-");
      // Make lowercase
      newUrl = newUrl.toLowerCase();
      // Remove characters that are not alphanumeric or a '-'
      newUrl = newUrl.replace(/[^a-z0-9-]/g, "");
      // Combine multiple dashes (i.e., '---') into one dash '-'.
      req.body.cafe.title = req.body.cafe.title;
      req.body.cafe.urlSlug = newUrl.replace(/[-]+/g, "-");
      req.body.cafe.description = req.body.cafe.description;
      req.body.cafe.topics = req.body.cafe.topics;
      req.body.cafe.views = 0;      
      req.body.cafe.createdAt = new Date();
      req.body.cafe.type = 'Post';

      //return res.status(200).json(req.body.cafe);      

      var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, user){
          req.body.cafe.userId = user._id;
          var newCafe = Cafe(req.body.cafe);           
          // save the Media
          newCafe.save(function(err) {
            if(err) return res.status(500).json(err);
            res.status(200).json("Cafe Post Created Successfully");
          });  
      });    
    });
  };

  this.update = function(req, res){
    var cafeID = req.body.vendor._id;
    var cafeData = req.body.vendor;
    Cafe.findOneAndUpdate({_id : cafeID}, cafeData, {upsert:true}, function(err, doc){
      if(err) return res.status(500).json(err);
      return res.status(200).json("Cafe info succesfully updated");
    });
  };

  this.trending = function(req, res){    
    Cafe.find({}).lean().exec(function(err, doc){
      if(err) return res.status(500).json(err);
      var topics = [];      
      for(i in doc) {
        topics = topics.concat(doc[i].topics);
      }
      var topics = underscore.uniq(topics);
      topics = topics.slice(0,15);
      return res.status(200).json({topics:topics, count:topics.length});
    });
  };

  this.allTopics = function(req, res){    
    Cafe.find({}).lean().exec(function(err, doc){
      if(err) return res.status(500).json(err);
      var topics = [];      
      for(i in doc) {
        topics = topics.concat(doc[i].topics);
      }
      var topics = underscore.uniq(topics);
      return res.status(200).json({topics:topics, count:topics.length});
    });
  };

  this.search = function(req, res){    
    var qString = req.query.q;
    var qRegExp = new RegExp('\\b'+qString, "i");    
    Cafe.find({topics : { $elemMatch: { $regex: qRegExp } }}, { topics : { $elemMatch: { $regex: qRegExp } } }).lean().exec(function(err, doc){
      if(err) return res.status(500).json(err);
      var topics = [];      
      for(i in doc) {
        topics = topics.concat(doc[i].topics);
      }
      var topics = underscore.uniq(topics);
      return res.status(200).json({topics:topics, count:topics.length});
    });
  };
  
  this.getCafe = function(req, res){
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function( callback)
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

      if(self.params.filters.topics.length) query.match['topics'] = { $all:self.params.filters.topics };
      //query.match.isActive = 1;

      //console.log(query.length);
      
      return query;
    };

    self.sortFilteredMedia = function(query, callback){ 
      var userIDs = [];
      async.parallel({        
        count : function(callbackInner)
        {          
          Cafe.aggregate(
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
        cafes : function(callbackInner)
        {
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
            case 'createdAt': query.sortBy = { 'createdAt' : -1 }; break;
          }
          query.sortBy._id = 1;
          Cafe.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            //{$project: query.projection}, 
            function(err, results) 
            {
              var userIds = [];
              for(i in results)
              {
                if(results[i].userId != undefined) userIds.push(results[i].userId);              
              }
              User.find({ _id:{ $in:userIds } }).lean().exec(function(err, users){
                userIds = [];
                for(i in users) userIds[users[i]._id] = users[i];
                for(i in results)
                {
                  if(results[i].userId != undefined) 
                    results[i].createdBy = userIds[results[i].userId].firstName + ' ' + userIds[results[i].userId].lastName;
                }
                callbackInner(err,results);
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
      topics : self.getTopics
    },                                                                                      
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getTopics = function(callback){
      Cafe.aggregate(
        { $match:{ isActive:1 } },
        { $unwind:'$topics' },
        { $group:{ _id:'$topics', count:{ $sum:1 } } },
        function(err, results) 
        {
          callback(err, results);
        }
      );
    };

  this.show = function(req, res){
    Cafe.findOne({_id: req.params.Id.toString()}).lean().exec(
      function(err, result)
      {        
        if(!result) res.status(404).json({error : 'No Such Cafe Found'});
        User.findOne({_id : result.userId}).lean().exec(function(err, userInfo){
          result['user'] = userInfo;
          return res.status(200).json({cafe : result});
        })        
      }
    );
    
    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      _id: req.params.Id.toString(),
      type: 'cafe'
    };
    CommonLib.uniqueVisits(visitor);
  };

};

module.exports.Cafe = Cafe;