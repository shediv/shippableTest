var Radio = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "radio";
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
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'radioFrequency' : 1,
        'station' : 1,
        'geography' : 1,
        'language' : 1,
        'mediaOptions.regularOptions' : 1,        
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
            case 'views': query.sortBy = { 'views' : -1 }; break;
            case 'rate10sec': query.sortBy = { 'mediaOptions.regularOptions.showRate.allDayPlan' : -1}; break;
            case 'city': query.sortBy = {}; break;
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
      if(err) res.status(500).json({err:err});
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
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, results)
      {
        if(!results) res.status(404).json({error : 'No Such Media Found'});
        res.status(200).json({radio : results});        
      }
    );
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'radioFrequency' : 1,
      'station' : 1,
      'urlSlug' : 1,
      'city' : 1,
      'language' : 1,
      'mediaOptions.regularOptions.showRate.allDayPlan' : 1,        
      'logo' : 1
    };
    
    Media.find({_id: { $in: ids }}, project,function(err, results){
      var medias = results.map(function(m){
        m['frequency'] = m.radioFrequency;
        delete m.radioFrequency;
        return m.toObject();
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
        $project : {
          '_id' : 1,
          'radioFrequency' : 1,
          'station' : 1,
          'geography' : 1,
          'language' : 1,
          'mediaOptions.regularOptions' : 1,        
          'logo' : 1
        }
      },
      function(err, results)
      {
        Geography.findOne({ _id:req.query.geographyId }, 'city').lean().exec(function(err, geo){
          for(i in results) results[i].city = geo.city;
          res.status(200).json({medias:results});
        });
      }
    );
  };
};




module.exports.Radio = Radio;