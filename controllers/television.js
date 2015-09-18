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
        'channelGenres' : 'categoryId',
        'languages' : 'language',
        'networks' : 'network',
        'channelNames' : 'name',
        'geographies' : 'geography'
      };
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'name'       : 1,
        'mediaOptions' : 1,
        'geography' : 1,
        'language' : 1,        
        'logo' : 1,
        'categoryId' : 1
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
            case 'views': query.sortBy = { 'views' : -1 }; break;
            //case 'channelGenre': query.sortBy = { 'channelGenre' : -1}; break;
            //case 'lowest10sec': query.sortBy = { 'channelGenre' : -1}; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              async.each(results, function(result, callback){
                Category.find({ _id:{ $in:result.categoryId } },'name').lean().exec(function(err, genres){
                  result.genres = [];
                  for(i in genres) result.genres.push(genres[i].name);
                  callback(err);
                })
              }, function(err){
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
      channelGenres : self.getCategories,
      channelNames : self.getChannelNames,
      languages : self.getLanguages,
      networks : self.getNetworks,
      geographies : self.getGeographies
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getCategories = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, categoryId: { $exists: 1}, isActive : 1}},
        {$unwind: '$categoryId'},
        {$group : { _id : '$categoryId', count : {$sum : 1}}},
        function(error, results) 
        {
          var catIds = [];
          results.map(function(o){ catIds.push(o._id); });
          Category.find({_id : {$in: catIds}},'name').lean().exec(function(err, cats){
            callback(error, cats);
          });
        }
      );
    };

    self.getGeographies = function(callback){
      Media.distinct('geography',
        { toolId:self.toolId , isActive:1 },
        function(error, geographyIds) 
        {
          Geography.find({_id : {$in: geographyIds}}).lean().exec(function(err, geos){
            var geographies = [];
            for(i in geos)
            {
              var key = Object.keys(geos[i])
              var key = key[key.length - 1];
              geographies.push({
                '_id' : geos[i]._id,
                'name' : geos[i][key]
              });
            }
            callback(error, geographies);
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
        {$match: {toolId:self.toolId, "name": { $exists: 1} }},
        {$group : { _id : '$name', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getLanguages = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "language": { $exists: 1} }},
        {$unwind: '$language'},
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
        Category.find({ _id:{ $in:results.categoryId } },'name').lean().exec(function(err, genres){
          results.genres = [];
          for(i in genres) results.genres.push(genres[i].name);
          res.status(200).json({television : results});
        })
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
      'language' : 1,
      'mediaOptions'  : 1,
      'categoryId' : 1
    };
    
    Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
      async.each(results, function(result, callback){
        Category.find({ _id:{ $in:result.categoryId } },'name').lean().exec(function(err, genres){
          result.genres = [];
          for(i in genres) result.genres.push(genres[i].name);
          callback(err);
        })
      }, function(err){
        res.status(200).json({medias:results});
      });
    });
  };
};

module.exports.Television = Television;