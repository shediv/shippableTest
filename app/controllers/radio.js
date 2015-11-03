var Radio = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var ToolsProject = require('../config/toolsProject.js');
  var CompareProject = require('../config/compareProject.js');
  var RelatedProject = require('../config/relatedProject.js');
  
  this.params = {};
  this.toolName = "radio";
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getRadios = function(req, res){
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function(callback)
      {
        callback(null, self.applyFilters());
      },
      function(query, callback)
      {
        if(self.params.recommended) return self.radioRecommend(query,callback);
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
        'geographies' : 'geography',
        'languages' : 'language',
        'stations' : 'station'
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
            case 'rate10sec': query.sortBy = { 'mediaOptions.regularOptions.allDayPlan.cardRate' : 1}; break;
            //case 'city': query.sortBy = {}; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
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
                if(self.params.sortBy == 'city') results.sort(function(a,b){ return a.city < b.city });
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

    self.radioRecommend = function(query, callback){
      query.match = {};
      query.sortBy = {};
      async.waterfall([
        function(callbackInner)
        {
          Products.findOne({ _id:self.params.productId },{ radio:1 }).lean().exec(function(err, result){
            console.log(result.radio.categoryId);
            callbackInner(err, result.radio.categoryId);
          });
        },
        function(categoryId, callbackInner)
        { 
         query.match['categories.'+categoryId] = { $exists:1 };
          query.match['geography'] = self.params.geography;
          query.sortBy['categories.'+categoryId] = 1;
          callbackInner(null, query);
        }
      ],
      function(err, query)
      { 
        Media.aggregate(
          {$match: query.match}, {$sort: query.sortBy},
          {$skip : 0}, {$limit: 2},
          {$project: query.projection}, 
          function(err, results) 
          { 
            var geographyIds = [];
            for(i in results) geographyIds.push(results[i].geography);
            Geography.find({_id : {$in: geographyIds}},'city').lean().exec(function(err, geos){
              geographies = {};
              for(i in geos) geographies[geos[i]._id] = geos[i];
              for(i in results) results[i]['city'] = geographies[results[i].geography].city;
              callback(err, {medias:results,count:results.length});
            });
          }
        );
      });
    }

  this.getFilters = function(req, res){
    async.parallel({
      geographies : self.getGeographies,
      stations : self.getStations,
      languages : self.getLanguages,
      products  : self.getProducts
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
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

    self.getStations = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "station": { $exists: 1} }},
        {$group : { _id : '$station', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getProducts = function(callback){
      Products.find({}, '_id name', function(error, results){
        callback(error, results);
      });
    };

  this.show = function(req, res){
    //req.params.urlSlug = decodeURI(req.params.urlSlug);
    Media.findOne({urlSlug: req.params.urlSlug, toolId : self.toolId, isActive:1}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      results.name = results.station + ', ' + results.city;
      if(results.about) {
          description = results.about;
        }else {
          description = results.station+ " in "+results.city+" plays music in "+results.language.join()+" language(s). "+results.station+" advertising is utilized by a variety of brands to reach out to their target audience. You can explore "+results.station+ " Advertising Rates & "+results.station+" Advertising Costs here";        
        }
        var metaTags = {
          title : results.station + ', ' + results.city,
          image  : results.imageUrl,
          description  : description,
          facebook : self.config.facebook,
          twitter : self.config.twitter
        }
      res.status(200).json({radio : results, metaTags : metaTags});        
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
      var medias = results.map(function(m){
        m['frequency'] = m.radioFrequency;
        delete m.radioFrequency;
        return m;
      });
      res.status(200).json({medias:medias});
    });
  };

  this.relatedMedia = function(req, res){
    Media.aggregate(
      {
        $match : {
          geography : req.query.geographyId,
          toolId : self.toolId,
          isActive: 1,
          urlSlug : { $ne : req.query.urlSlug }
        }
      },
      {$skip : 0}, {$limit: 3},
      {
        $project : RelatedProject[self.toolName]
      },
      function(err, results)
      {
        if(err) return res.status(500).json(err);
        Geography.findOne({ _id:req.query.geographyId }, 'city').lean().exec(function(err, geo){
          for(i in results) results[i].city = geo.city;
          res.status(200).json({medias:results});
        });
      }
    );
  };
};




module.exports.Radio = Radio;