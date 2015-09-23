var Digital = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "digital";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getDigital = function(req, res){
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
        'geoTargets' : 'geoTagging',
        'languages' : 'language',
        'categories' : 'categoryId',
        'pricingModels' : 'pricingModel',
        'mediums' : 'medium'
      };
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'name' : 1,
        'medium' : 1,
        'mediaOptions' : 1,
        'language' : 1,        
        'logo' : 1,
        'geoTagging' : 1,
        'reach1' : 1,
        'reach2' : 1,
        'unit1' : 1,
        'unit2' : 1,
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
            case 'medium': query.sortBy = { 'medium' : -1}; break;
            //case 'lowest10sec': query.sortBy = { 'channelGenre' : -1}; break;
          }
          query.sortBy._id = 1;
          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            //{$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              async.each(results, function(result, callback){
                if(result['reach1'] !== undefined && result['unit1'])
                  result['reach1'] = result['reach1'] + ' ' + result['unit1'];
                if(result['reach2'] !== undefined && result['unit2'])
                  result['reach2'] = result['reach2'] + ' ' + result['unit2'];
                
                firstmediaOptionsKey = Object.keys(result['mediaOptions'])[0];
                if(result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit1; }
                if(result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit2; }
                if(result.mediaOptions[firstmediaOptionsKey].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = result.mediaOptions[firstmediaOptionsKey].pricingUnit1; }
                if(result.mediaOptions[firstmediaOptionsKey].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = result.mediaOptions[firstmediaOptionsKey].pricingUnit2; }                                      
                
                if(minimumQtyUnit2)
                {
                  minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
                  minimumBilling = (result.mediaOptions[firstmediaOptionsKey].cardRate * minimumQtyUnit1 * minimumQtyUnit2);
                }
                else
                {
                  minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;
                  minimumBilling =  result.mediaOptions[firstmediaOptionsKey].cardRate *  minimumQtyUnit1;
                }
                result['minimumBilling'] = minimumBilling;
                Category.findOne({ _id:result.categoryId },'name').lean().exec(function(err, cat){
                  if(cat) result.categoryName = cat.name;
                  callback(err);
                });
              }, function(err){
                if(self.params.sortBy == 'minimumBilling') results.sort(function(a,b){ return a.minimumBilling < b.minimumBilling });
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
      categories : self.getCategories,
      mediums : self.getMediums,
      geoTargets : self.getGeoTargets,
      pricingModels : self.getPricingModels,
      languages : self.getLanguages
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getCategories = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, isActive : 1}},
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

    self.getMediums = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "medium": { $exists: 1} }},
        {$group : { _id : '$medium', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getGeoTargets = function(callback){
      var geoTargets = [
        {'_id' : true, 'name' : 'Yes'},
        {'_id' : false, 'name' : 'No'}
      ];
      callback(null, geoTargets);
    };

    self.getPricingModels = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "pricingModel": { $exists: 1} }},
        {$unwind: '$pricingModel'},
        {$group : { _id : '$pricingModel', count : {$sum : 1}}},
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
    async.parallel({
      visitor : function(callbackInner)
        {    
          var origin = req.originalUrl;
          var origin = origin.split("/");
          var type = 'media';
          var user = {
                        userAgent: req.headers['user-agent'],
                        remoteAddress: req.connection.remoteAddress,                        
                        type: type,
                        urlSlug: req.params.urlSlug
                      }

          CommonLib.checkUniqueVisitor(user, function(err, newVisitor){
              callbackInner(err, newVisitor);
            });                                 
        },
      media : function(callbackInner)
        {
          Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
            function(err, results)
            {
            if(!results) res.status(404).json({error : 'No Such Media Found'});
            callbackInner(err, results);        
            }
          ); 
          
        }
      },
      function(err, results) 
      {
        Category.findOne({ _id:results.media.categoryId },'name').lean().exec(function(err, cat){
          if(cat) results.media.categoryName = cat.name;
          res.status(200).json({digital : results.media});        
        });
      });                  
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'urlSlug' : 1,
      'name' : 1,
      'medium' : 1,
      'mediaOptions' : 1,
      'language' : 1,        
      'logo' : 1,
      'geoTagging' : 1,
      'reach1' : 1,
      'reach2' : 1,
      'unit1' : 1,
      'unit2' : 1,
      'categoryId' : 1
    };
    
    Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
      async.each(results, function(result, callback){
        if(result['reach1'] !== undefined && result['unit1'])
          result['reach1'] = result['reach1'] + ' ' + result['unit1'];
        if(result['reach2'] !== undefined && result['unit2'])
          result['reach2'] = result['reach2'] + ' ' + result['unit2'];
        
        firstmediaOptionsKey = Object.keys(result['mediaOptions'])[0];
        if(result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit1; }
        if(result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit2; }
        if(result.mediaOptions[firstmediaOptionsKey].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = result.mediaOptions[firstmediaOptionsKey].pricingUnit1; }
        if(result.mediaOptions[firstmediaOptionsKey].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = result.mediaOptions[firstmediaOptionsKey].pricingUnit2; }                                      
        
        if(minimumQtyUnit2)
        {
          minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
          minimumBilling = (result.mediaOptions[firstmediaOptionsKey].cardRate * minimumQtyUnit1 * minimumQtyUnit2);
        }
        else
        {
          minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;
          minimumBilling =  result.mediaOptions[firstmediaOptionsKey].cardRate *  minimumQtyUnit1;
        }
        result['minimumBilling'] = minimumBilling;
        Category.findOne({ _id:result.categoryId },'name').lean().exec(function(err, cat){
          if(cat) result.categoryName = cat.name;
          callback(err);
        });
      }, function(err){
        res.status(200).json({medias:results});  
      });
    });
  };
};

module.exports.Digital = Digital;