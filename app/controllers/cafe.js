var Cafe = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Cafe = require('../models/cafe').Cafe;
  var underscore = require('underscore');
  
  this.params = {};
  var self = this;

  this.store = function(req, res){
    // create a new Media
    var newCafe = Cafe(req.body);

    // save the Media
    newCafe.save(function(err) {
      if(err) return res.status(500).json(err);
      res.status(200).json("Cafe Created Successfully");
    });
  };

  this.update = function(req, res){
    var cafeID = req.body.vendor._id;
    var cafeData = req.body.vendor;
    Cafe.findOneAndUpdate({_id : cafeID}, cafeData, {upsert:true}, function(err, doc){
      if(err) return res.status(500).json(err);
      return res.send("Cafe info succesfully updated");
    });
  };

  this.trending = function(req, res){    
    Cafe.find({}).lean().limit(15).exec(function(err, doc){
      if(err) return res.status(500).json(err);
      var topics = [];      
      for(i in doc) {
        topics = topics.concat(doc[i].topics);
      }
      var topics = underscore.uniq(topics);
      return res.send({topics:topics, count:topics.length});
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
      return res.send({topics:topics, count:topics.length});
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

      if(self.params.filters.topics.length) query.match['topics'] = { $in:self.params.filters.topics };
      //query.match.isActive = 1;
      
      return query;
    };

    self.sortFilteredMedia = function(query, callback){ 
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
          }
          query.sortBy._id = 1;
          Cafe.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            //{$project: query.projection}, 
            function(err, results) 
            {
              callbackInner(err,results);
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
    Cafe.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, result)
      {
        if(!result) res.status(404).json({error : 'No Such Cafe Found'});
        res.status(200).json({cafe : result});
      }
    );
    
    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.connection.remoteAddress,
      urlSlug: req.params.urlSlug,
      type: 'cafe'
    };
    CommonLib.uniqueVisits(visitor);
  };

};

module.exports.Cafe = Cafe;