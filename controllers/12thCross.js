var _12thCross = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Model12thCross = require('../models/12thCross').Model12thCross;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var SubCategory = require('../models/subCategory').SubCategory;
  
  this.params = {};
  var self = this;
  
  /*Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });*/
  
  this.get12thCross = function(req, res){ 
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function( callback)
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
      res.status(200).json(result);
    });
  };

    

    self.applyFilters = function(geographies){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};
      query.projection = {
        '_id'          : 1,
        'name'         : 1,
        'about'        : 1,
        'mediaOptions' : 1,
        'geography'    : 1,
        'urlSlug'      : 1
      };
      
      if(self.params.filters.geographies !== undefined) query.match['geography'] = { $in:self.params.geographyIds };
      if(self.params.filters.subCategories.length) query.match['subCategoryId'] = { $in:self.params.filters.subCategories };
      query.match['hyperLocal'] = self.params.filters.hyperLocal;
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
            case 'name': query.sortBy = { 'name' : -1 }; break;
            case 'minimumBilling': query.sortBy = {}; break;
            
          }
          query.sortBy._id = 1;
          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
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
        Categories : self.serviceProvided
        /*planning : self.getPlanning,
        design : self.getDesign,
        marketingServices : self.getMarketingServices,
        mediaBuying : self.getmediaBuying,*/

      },                                                                                      
      function(err, results) 
      {
        if(err) res.status(500).json({err:err});
        res.status(200).json({filters:results});
      });
    };

    self.serviceProvided = function(callback){
      /*Model12thCross.aggregate(
        {$match : {categoryId: { $exists: 1}, isActive : 1}},
        {$unwind: '$categoryId'},
        {$group : { _id : '$categoryId', count : {$sum : 1}}},
        function(err,results){
          var catgoryIds = [];
          results.map(function(o){ catgoryIds.push(o._id); });
          Category.find({_id : {$in: catgoryIds}},'name').lean().exec(function(err, cats){

          callback(err, cats);
          });
        });*/
        async.parallel({
        categories: function(callbackInner){
          Model12thCross.aggregate(
            {$match : {categoryId: { $exists: 1}, isActive : 1}},
            {$unwind: '$categoryId'},
            {$group : { _id : '$categoryId', count : {$sum : 1}}},
            function(err,results){
              var catgoryIds = [];
              results.map(function(o){ catgoryIds.push(o._id); });
              Category.find({_id : {$in: catgoryIds}},'name').lean().exec(function(err, cats){
              callbackInner(err, cats);
              });
            }
          );
        },
        subCategories: function(callbackInner){
          Model12thCross.aggregate(
            {$match : {subCategoryId: { $exists: 1}, isActive : 1}},
            {$unwind: '$subCategoryId'},
            {$group : { _id : '$subCategoryId'}},
            /*{$project : {'subCategoryId' : 1}},*/
            function(err,results){
              console.log(results);
              callbackInner(err,results);
            } 
          );
        }
      }, 
      function(err, result)
      {
        /*for(i in result.categories)
          result.categories[i].subCategories = result.subCategories[result.categories[i]._id];
        callback(err, result.categories);*/
        callback(err,result);
      });
    };

    

    this.show = function(req, res){
      Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
        function(err, result)
        {
          if(!result) res.status(404).json({error : 'No Such Media Found'});
          Geography.findOne({ _id:result.geography}).lean().exec(function(err, geo){
            if(geo) result['geographyData'] = geo;
            res.status(200).json({nonTraditional : result});
          });
        }
      );
    };

};

module.exports._12thCross = _12thCross;