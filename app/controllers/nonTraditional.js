var NonTraditional = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var SubCategory = require('../models/subCategory').SubCategory;
  var ToolsProject = require('../config/toolsProject.js');
  var underscore = require('underscore');
  
  this.params = {};
  this.toolName = "nontraditional";
  this.config = require('../config/config.js');
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });
  
  this.getNonTraditional = function(req, res){ 
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function(callback)
      {
        self.buildGeographyQuery(callback);
      },
      function(geographies, callback)
      {
        callback(null, self.applyFilters(geographies));
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

    self.buildGeographyQuery = function(callback){
      var or = [];
      self.params.geographyIds = [];
      if(!self.params.filters.geographies.length)
      {
       delete self.params.filters.geographies;
       return callback(null, []); 
      }
      for(key in self.params.filters.geographies)
      {
        switch(self.params.filters.geographies[key].place)
        {
          case 'state' : 
            or.push(
              { $and : [{ state :self.params.filters.geographies[key].state}] }
            ); 
            break;                  
          case 'city' : 
            or.push({ 
              $and : [
                { state :self.params.filters.geographies[key].state}, 
                { city : self.params.filters.geographies[key].city}
              ] 
            }); 
            break;          
          case 'locality' : 
            or.push({ 
              $and : [
                { state :self.params.filters.geographies[key].state}, 
                { city : self.params.filters.geographies[key].city},
                { locality : self.params.filters.geographies[key].locality}
              ] 
            });          
        }
      }      

      var match = { $or:or, pincode : { $exists:1 } };
      async.series([
        function(callbackInner){
          Geography.distinct('pincode', match, function(err, pincodes){   /*get pincodes in an array*/
            Geography.find({pincode:{$in:pincodes}}).lean().exec(function(err, results){
              var geographies = [];
              if(!results) return callbackInner(err, geographies);
              for(i in results)
              {
                geographies[results[i]._id.toString()] = results[i];
                self.params.geographyIds.push(results[i]._id.toString());
              }
              callbackInner(err, geographies); 
            });
          });
        } 
      ],
      function(err, geographies)
      {
       callback(err, geographies[0]);
      });
    };

    self.applyFilters = function(geographies){

      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};
      query.projection = ToolsProject[self.toolName];
      if(self.params.filters.geographies !== undefined) query.match['geography'] = { $in:self.params.geographyIds };
      if(self.params.filters.subCategories.length) query.match['subCategoryId'] = { $in:self.params.filters.subCategories };
      if(self.params.filters.hyperlocal) query.match['hyperLocal'] = self.params.filters.hyperlocal;
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
            case 'name': query.sortBy = { 'name'   : 1 }; break;
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
              for(i in results) geographyIds = geographyIds.concat(results[i].geography);
              Geography.find({_id : {$in: geographyIds}}).lean().exec(function(err, geos){
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

                  results[i]['minimumUnit'] = minimumUnit;
                  results[i]['minimumBilling'] = minimumBilling; 
                  results[i]['firstMediaOption'] = firstmediaOptionsKey; 
                }                                   
                for(i in results) results[i]['geography'] = geographies[results[i].geography];
                if(self.params.sortBy == 'minimumBilling') results = results.sort(function(a,b){ return a.minimumBilling > b.minimumBilling });
                //results = results.slice(self.params.offset, self.params.limit + self.params.offset);
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
      categories: self.getCategories,
      reach: self.getReaches
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getCategories = function(callback){
      async.parallel({
        categories: function(callbackInner){
          Media.distinct('categoryId',
           { toolId:self.toolId },
           function(error, categoryIds)
           {
             Category.find({_id : {$in: categoryIds}},'name').lean().exec(function(err, cats){
              callbackInner(err, cats);
            });
           }
          );
        },
        subCategories: function(callbackInner){
          Media.distinct('subCategoryId',
            { toolId:self.toolId },
            function(error, subCategoryIds)
            {
              SubCategory.find({ _id:{ $in:subCategoryIds } }).lean().exec(function(err, result){
                var subObj = {};
                for(i in result)
                {
                  if(!subObj[result[i].categoryId]) subObj[result[i].categoryId] = [];
                  subObj[result[i].categoryId].push(result[i]);
                }
                callbackInner(err, subObj);
              });
            }
          );
        }
      }, 
      function(err, result)
      {
        for(i in result.categories)
        {
          result.categories[i].subCategories = result.subCategories[result.categories[i]._id];
          result.categories[i].subCategories.sort(function(a,b){ return a.name > b.name });
        }
        result.categories.sort(function(a,b){ return a.name > b.name });
        callback(err, result.categories);
      });
    };

    self.getReaches = function(callback){
      var MediaType = [
        {'_id' : 'hyperlocal', 'name' : 'Hyperlocal'},
        //{'_id' : 'mass', 'name' : 'Mass'}
      ];
      callback(null, MediaType);
    };

  this.show = function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(function(err, result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(404).json({error : 'No Such Media Found'});
      Geography.findOne({ _id:result.geography}).lean().exec(function(err, geo){
        if(geo) result['geographyData'] = geo;

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
        res.status(200).json({nonTraditional : result, metaTags : metaTags});
      });
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
      { toolId:"55f180b344aef45d8f1531d5", isActive:1 },
      function(error, result) 
      {          
        var keys = [];
        for(i in result){
          keys = keys.concat(Object.keys(result[i]));
        }          
        var mediaOptions = underscore.uniq(keys)
        return res.status(200).json({mediaOptions : mediaOptions, count : mediaOptions});
      }
    );                 
  };
};

module.exports.NonTraditional = NonTraditional;