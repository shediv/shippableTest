var Inflight = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "airport";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getInflight = function(req, res){
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
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'name' : 1,
        'category' : 1,
        'mediaOptions' : 1,
        'geography' : 1,        
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
            case 'category': query.sortBy = { 'category' : -1}; break;
            case 'minimumBilling': query.sortBy = {}; break;
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
                console.log(geos);
                process.exit();
                geographies = {};
                for(i in geos) geographies[geos[i]._id] = geos[i];

                //To find minimum unit and minimum Billing 
                for(i in results)
                {
                  mediaOptions.push(results[i]['mediaOptions']);
                  firstmediaOptionsKey = Object.keys(mediaOptions[i])[0];
                  if(results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit1; }
                  if(results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = results[i].mediaOptions[firstmediaOptionsKey].minimumQtyUnit2; }
                  if(results[i].mediaOptions[firstmediaOptionsKey].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = results[i].mediaOptions[firstmediaOptionsKey].pricingUnit1; }
                  if(results[i].mediaOptions[firstmediaOptionsKey].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = results[i].mediaOptions[firstmediaOptionsKey].pricingUnit2; }                                      
                  
                  if(minimumQtyUnit2)
                  {
                    minimumUnit = minimumQtyUnit1 + pricingUnit1 + '/' + minimumQtyUnit2 + pricingUnit2;
                    minimumBilling = (results[i].mediaOptions[firstmediaOptionsKey].cardRate * minimumQtyUnit1 * minimumQtyUnit2);
                  }
                  else
                  {
                    minimumUnit =  minimumQtyUnit1 +  pricingUnit1;
                    minimumBilling =  results[i].mediaOptions[firstmediaOptionsKey].cardRate *  minimumQtyUnit1;
                  }

                  results[i]['minimumUnit'] = minimumUnit;
                  results[i]['minimumBilling'] = minimumBilling; 
                }                                   

                for(i in results) results[i]['city'] = geographies[results[i].geography].city;
                if(self.params.sortBy == 'minimumBilling') results.sort(function(a,b){ return a.minimumBilling < b.minimumBilling });
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
            callback(error, geos);
          });
        }
      );
    };

    self.getCategories = function(callback){
      var categories = [
        {'_id' : 'airport', 'name' : 'Airport'},
        {'_id' : 'airportLounge', 'name' : 'Airport Lounge'},
        {'_id' : 'airline', 'name' : 'Airline'},
        {'_id' : 'inflightMagazine', 'name' : 'Inflight Magazine'}
      ];
      callback(null, categories);
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
};

module.exports.Inflight = Inflight;