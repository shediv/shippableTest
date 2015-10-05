var Outdoor = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "outdoor";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getOutdoor = function(req, res){
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
        'mediaTypes' : 'mediaType',
        //'landmarks' : 'landmark',
        'sizes' : 'size',
        'litTypes' : 'litType'
      };
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'uniqueId' : 1,
        'name' : 1,
        'mediaType' : 1,
        'mediaOptions' : 1,
        'geography' : 1,
        'size' : 1,        
        'logo' : 1,
        'litType' : 1
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
            case 'price': query.sortBy = { 'mediaOptions.showRate' : 1}; break;
            case 'size': query.sortBy = { 'mediaOptions.area': 1 }; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              var geographyIds = [];
              var mediaOptions = [];
              var firstmediaOptionsKey;
              var minimumQtyUnit1;
              var minimumQtyUnit2;
              var pricingUnit1;
              var pricingUnit2;
              var minimumUnit;
              var minimumBilling; 
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
      mediaTypes : self.getMediaTypes,
      //landmarks : self.getLandmarks,
      sizes : self.getSizes,
      litTypes : self.getLitTypes
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getMediaTypes = function(callback){
      var mediaTypes = [
        {'_id' : 'Hoarding', 'name' : 'Hoarding'},
        {'_id' : 'Bus Shelters', 'name' : 'Bus Shelters'},
        {'_id' : 'Pole Kiosk', 'name' : 'Pole Kiosk'}
      ];
      callback(null, mediaTypes);
    };

    self.getSizes = function(callback){
      var sizes = [
        {'_id' : 'Small', 'name' : 'Small'},
        {'_id' : 'Large', 'name' : 'Large'},
        {'_id' : 'Medium', 'name' : 'Medium'}
      ];
      callback(null, sizes);
    };

    self.getLandmarks = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "landmark": { $exists: 1} }},
        {$group : { _id : '$landmark', count : {$sum : 1}}},
        function(err, results) 
        {
          callback(err, results);
        }
      );
    };

    self.getLitTypes = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "litType": { $exists: 1} }},
        {$group : { _id : '$litType', count : {$sum : 1}}},
        function(err, results) 
        {
          callback(err, results);
        }
      );
    };

  this.show = function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      Geography.findOne({ _id:results.geography }).lean().exec(function(err, geo){
        if(geo) results['geographyData'] = geo;
        res.status(200).json({outdoor : results});
      });
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.connection.remoteAddress,
      urlSlug: req.params.urlSlug,
      type: 'media',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  };

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'urlSlug' : 1,
      'name' : 1,
      'landmark' : 1,
      'mediaType' : 1,
      'mediaOptions.ratePerSquareFeet' : 1,
      'mediaOptions.showRate' : 1,
      'geography' : 1,        
      'logo' : 1
    };
    
    Media.find({_id: { $in: ids }}, project,function(err, results){
      if(err) return res.status(500).json(err);
      res.status(200).json({medias:results});
    });
  };
};




module.exports.Outdoor = Outdoor;