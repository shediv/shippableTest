var Airport = function()
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
  var underscore = require('underscore');
  
  this.params = {};
  this.toolName = "airport";
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getAirport = function(req, res){
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
        'geographies' : 'geography',
        'categories' : 'category'
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
            case 'category': query.sortBy = { 'category' : -1}; break;
            case 'minimumBilling': query.sortBy = {}; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            //{$skip : query.offset}, {$limit: query.limit},
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

                //To find minimum unit and minimum Billing 
                for(i in results)
                {
                  firstmediaOptionsKey = Object.keys(results[i]['mediaOptions'])[0];
                  if(results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit1; }
                  if(results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit2; }
                  if(results[i].mediaOptions[firstmediaOptionsKey].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = results[i].mediaOptions[firstmediaOptionsKey].pricingUnit1; }
                  if(results[i].mediaOptions[firstmediaOptionsKey].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = results[i].mediaOptions[firstmediaOptionsKey].pricingUnit2; }                                      
                  
                  if(minimumQtyUnit2)
                  {
                    minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
                    minimumBilling = (results[i].mediaOptions[firstmediaOptionsKey].cardRate * minimumQtyUnit1 * minimumQtyUnit2);
                  }
                  else
                  {
                    minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;
                    minimumBilling =  results[i].mediaOptions[firstmediaOptionsKey].cardRate *  minimumQtyUnit1;
                  }
                  results[i]['firstMediaOption'] = results[i].mediaOptions[firstmediaOptionsKey].name;
                  results[i]['minimumUnit'] = minimumUnit;
                  results[i]['minimumBilling'] = minimumBilling; 
                }                                   

                for(i in results) results[i]['city'] = geographies[results[i].geography].city;
                if(self.params.sortBy == 'minimumBilling') results.sort(function(a,b){ return a.minimumBilling - b.minimumBilling });
                results = results.slice(self.params.offset, self.params.limit + self.params.offset);
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
      geographies : self.getGeographies,
      categories : self.getCategories
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
            for(i in geos) if(geos[i].city === undefined) geos[i].city = 'All India';
            callback(error, geos);
          });
        }
      );
    };

    self.getCategories = function(callback){
      var categories = [
        {'_id' : 'Airport', 'name' : 'Airport'},
        {'_id' : 'Airport Lounge', 'name' : 'Airport Lounge'},
        {'_id' : 'Airline', 'name' : 'Airline'}
      //{'_id' : 'InflightMagazine', 'name' : 'Inflight Magazine'}
      ];
      callback(null, categories);
    };

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = CompareProject[self.toolName];
      
    Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
      
      var geographyIds = [];
      var mediaOptions = [];
      var firstmediaOptionsKey;
      var minimumQtyUnit1;
      var minimumQtyUnit2;
      var pricingUnit1;
      var pricingUnit2;
      var minimumUnit;
      var minimumBilling; 

      for(i in results)
      {
        firstmediaOptionsKey = Object.keys(results[i]['mediaOptions'])[0];
        if(results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit1; }
        if(results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit2; }
        if(results[i].mediaOptions[firstmediaOptionsKey].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = results[i].mediaOptions[firstmediaOptionsKey].pricingUnit1; }
        if(results[i].mediaOptions[firstmediaOptionsKey].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = results[i].mediaOptions[firstmediaOptionsKey].pricingUnit2; }                                      
        
        if(minimumQtyUnit2)
        {
          minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
          minimumBilling = (results[i].mediaOptions[firstmediaOptionsKey].cardRate * minimumQtyUnit1 * minimumQtyUnit2);
        }
        else
        {
          minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;
          minimumBilling =  results[i].mediaOptions[firstmediaOptionsKey].cardRate *  minimumQtyUnit1;
        }

        results[i]['minimumUnit'] = minimumUnit;
        results[i]['minimumBilling'] = minimumBilling;
        results[i]['firstMediaOption'] = results[i].mediaOptions[firstmediaOptionsKey].name;
      }                                   
      res.status(200).json({medias:results});
    });
  };

  this.show = function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug, toolId : self.toolId }).lean().exec(function(err, result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(404).json({error : 'No Such Media Found'});
      var minimumQtyUnit1;
      var minimumQtyUnit2;
      var pricingUnit1;
      var pricingUnit2;
      var minimumUnit;

      for(i in result.mediaOptions)
      {        
        if(result.mediaOptions[i].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = result.mediaOptions[i].minimumQtyUnit1; }
        if(result.mediaOptions[i].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = result.mediaOptions[i].minimumQtyUnit2; }
        if(result.mediaOptions[i].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = result.mediaOptions[i].pricingUnit1; }
        if(result.mediaOptions[i].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = result.mediaOptions[i].pricingUnit2; }                                      
        
        if(minimumQtyUnit2)
        {
          minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;          
        }
        else
        {
          minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;          
        }
        result.mediaOptions[i]['minimumUnit'] = minimumUnit;              
      }

      var metaTags = {
          title : result.name,
          image  : result.imageUrl,
          description  : result.about,
          facebook : self.config.facebook,
          twitter : self.config.twitter
        }
      res.status(200).json({airport : result, metaTags : metaTags});
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

  this.getMediaOption = function(req, res){    
    Media.distinct('mediaOptions',
        { toolId:"55f08b5044ae1ef71a02f415", isActive:1 },
        function(error, result) 
        {          
          var keys = [];
          for(i in result){
            keys = keys.concat(Object.keys(result[i]));
          }          
          var mediaOptions = underscore.uniq(keys)
          return res.status(200).json({mediaOptions : mediaOptions, count : mediaOptions.length});
        });                 
  };

};

module.exports.Airport = Airport;