var Television = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "television";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getTelevision = function(req, res){
    self.params = JSON.parse(req.query.params);
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
      res.status(200).json(result);
    });
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};
      var filters = {
        'channelGenres' : 'channelGenre',
        'languages' : 'language',
        'networks' : 'network',
        'channelNames' : 'channelName',
        'geographies' : 'geography'
      };
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'name'       : '$channelName',
        'channelGenre' : 1,
        'category' : 1,
        'mediaOptions' : 1,
        'geography' : 1,
        'language' : 1,        
        'logo' : 1
      };

      Object.keys(filters).map(function(value){
        if(self.params.filters[value].length)
          query.match[filters[value]] = {'$in': self.params.filters[value]};
      });

      query.match.isActive = 1;
      query.match.toolId = self.toolId;
      return query;
    };

    self.sortFilteredMedia = function(query, callback){      
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
        medias : function(callbackInner)
        {          
          switch(query.sortBy)
          {
            case 'topSearched': query.sortBy = { 'views' : -1 }; break;
            case 'channelGenre': query.sortBy = { 'channelGenre' : -1}; break;
            //case 'lowest10sec': query.sortBy = { 'channelGenre' : -1}; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, //{$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              var geographyIds = [];                            
              for(i in results) geographyIds.push(results[i].geography);
              Geography.find({_id : {$in: geographyIds}},'city').lean().exec(function(err, geos){
                geographies = {};
                for(i in geos) geographies[geos[i]._id] = geos[i];
                for(i in results) results[i]['city'] = geographies[results[i].geography].city;                
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
      channelGenres : self.getChannelGenres,
      languages : self.getLanguages,
      channelNames : self.getChannelNames,
      networks : self.getNetworks,
      geographies : self.getGeographies
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getChannelGenres = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "channelGenre": { $exists: 1} }},
        {$group : { _id : '$channelGenre', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getGeographies = function(callback){
      Media.distinct('geography',
        { toolId:self.toolId , isActive:1 },
        function(error, geographyIds) 
        {
          Geography.find({_id : {$in: geographyIds}},'city').lean().exec(function(err, geos){
            callback(error, geos);
          });
        }
      );
    };

    self.getNetworks = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "network": { $exists: 1} }},
        {$group : { _id : '$network', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getChannelNames = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "channelName": { $exists: 1} }},
        {$group : { _id : '$channelName', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getLanguages = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "language": { $exists: 1} }},
        {$group : { _id : '$language', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

  this.show = function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, results)
      {
        if(!results) res.status(404).json({error : 'No Such Media Found'});
        res.status(200).json({television : results});        
      }
    );
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'urlSlug' : 1,
      'name' : 1,
      'locality' : 1,
      'landmark' : 1,
      'price' : 1,
      'category' : 1,
      'mediaOptions' : 1,
      'geography' : 1,        
      'logo' : 1
    };
    
    Media.find({_id: { $in: ids }}, project,function(err, results){
      res.status(200).json({medias:results});
    });
  };
};

module.exports.Television = Television;