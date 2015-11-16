var Television = function()
{
  var async = require('async');
  var underscore = require('underscore')._;
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var ToolsProject = require('../config/toolsProject.js');
  var CompareProject = require('../config/compareProject.js');
  
  this.params = {};
  this.toolName = "television";
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
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
      var filters = {
        'channelGenres' : 'categoryId',
        'languages' : 'language',
        'networks' : 'network',
        'channelNames' : 'name',
        'geographies' : 'geography'
      };
      query.projection = ToolsProject[self.toolName];

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
                  if(result.mediaOptions !== undefined)
                  {
                    var price = [];
                    for(i in result.mediaOptions) price.push(result.mediaOptions[i].cardRate)
                    result.rate = underscore.min(price)
                  }
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
      if(err) return res.status(500).json(err);
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
    //req.params.urlSlug = decodeURI(req.params.urlSlug);
    Media.findOne({urlSlug: req.params.urlSlug, toolId : self.toolId, isActive:1}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      Category.find({ _id:{ $in:results.categoryId } },'name').lean().exec(function(err, genres){
        results.genres = [];
        for(i in genres) results.genres.push(genres[i].name);

        keyWords= [results.name+ ' Advertainment ', results.name+ ' Audience ', results.name+ ' Bumpers', results.name+ ' Campaign Period ', results.name+ ' Commercial Minutage ', results.name+ ' First In Break advertising ', results.name+ ' Frequency ', results.name+ ' Gross Rating Point (GRP) ', results.name+ ' Infomercial ', results.name+  ' advertising rates ', results.name+  ' ad rates ', results.name+  ' media kit ', results.name+  ' card rates ', results.name+  ' advertising ', results.name+  ' advertising details ', results.name+  ' pricing details ', 'how to advertise in ' +results.name, results.name+  ' media rates ', results.name+  'advertising manager ', results.name+  ' contact details ', results.name+  ' advertising contact', results.name+  ' media contact ', 'ad spots '];  
        var metaTags = {
          title : results.name + ' TV channel Advertising >> Rates for '+results.name+' TV channel Advertisement',
          image  : results.imageUrl,
          description  : results.name+' is a '+results.language.join()+' TV channel in '+results.genres.join()+' Genre. You can explore '+results.name+' TV channel Advertising rates and '+results.name+' TV channel Advertising cost here.',
          facebook : self.config.facebook,
          twitter : self.config.twitter,
          keyWords : keyWords
        }  
        res.status(200).json({television : results, metaTags : metaTags});
      })
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      urlSlug: req.params.urlSlug,
      type: 'media',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  };

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = CompareProject[self.toolName];
    
    Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      async.each(results, function(result, callback){
        Category.find({ _id:{ $in:result.categoryId } },'name').lean().exec(function(err, genres){
          result.genres = [];
          for(i in genres) result.genres.push(genres[i].name);
          if(result.mediaOptions !== undefined)
          {
            var price = [];
            for(i in result.mediaOptions) price.push(result.mediaOptions[i].cardRate)
            result.rate = underscore.min(price)
          }
          callback(err);
        })
      }, function(err){
        res.status(200).json({medias:results});
      });
    });
  };
};

module.exports.Television = Television;