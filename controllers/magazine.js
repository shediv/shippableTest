var Magazine = function()
{
  var async = require('async');
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;

  this.params = {};
  this.toolName = "magazine";
  this.toolId;
  var scope = this;
  Tools.findOne({name: this.toolName}, function(err, result){
    scope.toolId = result._id.toString();
  });

  this.getMagazines = function(req, res){
    scope.params = JSON.parse(req.query.params);
    if(scope.params.tmaRecommended) res.status(200).json("tma recommended");
    async.waterfall([
      function(callback)
      {
        callback(null, scope.applyFilters());
      },
      function(query, callback)
      {
        scope.sortFilteredMedia(query, callback);
      }
    ],
    function (err, result) 
    {
      res.status(200).json(result);
    });
  }

    scope.applyFilters = function(){
      var query = {};
      query.sortBy = scope.params.sortBy || 'views';
      query.offset = scope.params.offset || 0;
      query.limit = scope.params.limit || 9;
      query.match = {};
      var filters = {
        'categories' : 'categoryId',
        'geography' : 'geography',
        'languages' : 'attributes.language.value',
        'frequencies' : 'attributes.frequency.value',
        'targetGroups' : 'targetGroup'
      };
      query.projection = { 
        '_id' : 1, 
        'attributes' : 1, 
        'urlSlug' : 1, 
        'thumbnail' : 1, 
        'categoryId' : 1, 
        'name' : 1,
        'mediaOptions.print.fullPage.1-2' : 1, 
        'toolId' : 1, 
        'createdBy' : 1
      };

      Object.keys(filters).map(function(value){
        if(scope.params.filters[value].length) 
          query.match[filters[value]] = {'$in': scope.params.filters[value]};
      });

      scope.params.filters.mediaOptions.forEach(function(value, key){
        query.match['mediaOptions.'+value] = { $exists : 1};
      });
      query.match.isActive = 1;
      query.match.toolId = scope.toolId;
      return query;
    };

    scope.sortFilteredMedia = function(query, callback){
      async.parallel({
        count : function(callbackInner)
        {
          Media.aggregate(
            {$match : query.match}, 
            {$group: { _id : null, count: {$sum: 1} }}, 
            function(err, result)
            {
              callbackInner(err, result[0].count);
            }
          );
        },
        magazines : function(callbackInner)
        {
          switch(query.sortBy) 
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
            case 'circulation': query.sortBy = { 'attributes.circulation.value' : -1}; break;
            case 'readership': query.sortBy = { 'attributes.readership.value' : -1}; break;
            case 'price': query.sortBy = { 'mediaOptions.print.fullPage.1-2' : -1}; break;
          }
          Media.aggregate(
            {$match: query.match}, 
            {$sort: query.sortBy}, 
            {$skip : query.offset},
            {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results)
            {
              callbackInner(err, results);
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
      categories: scope.getCategories,
      geography : scope.getGeographies,
      languages : scope.getLanguages,
      targetGroups : scope.getTargetGroups,
      frequencies : scope.getFrequencies,
      mediaOptions: scope.getMediaOptions,
      products : scope.getProducts
    }, 
    function(err, results)
    {
      if(err)
      {
        console.log(err); 
        res.status(200).json({err:err});  
      }
      res.status(200).json({filters:results});
    });
  };

    scope.getCategories = function(callback){
      Media.aggregate(
        {$match: {toolId:scope.toolId, isActive : 1}},
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

    scope.getGeographies = function(callback){
      Media.aggregate(
        {$match: {toolId:scope.toolId, geography: { $exists: 1}, isActive : 1}}, 
        {$unwind: '$geography'}, 
        {$group : { _id : '$geography', count : {$sum : 1}}}, 
        function(error, results)
        {
          var geoIds = [];
          results.map(function(o){ geoIds.push(o._id); });
          Geography.find({_id : {$in: geoIds}},'name').lean().exec(function(err, geos){
            callback(error, geos);
          });
        }
      );
    };

    scope.getLanguages = function(callback){
      Media.aggregate(
        {$match: {toolId:scope.toolId, "attributes.language.value": { $exists: 1}, isActive : 1}},
        {$group : { _id : '$attributes.language.value', count : {$sum : 1}}}, 
        function(error, results)
        {
          callback(error, results);
        }
      );
    };

    scope.getTargetGroups = function(callback){
      Media.aggregate(
        {$match: {toolId:scope.toolId, targetGroup: { $exists: 1}, isActive : 1}}, 
        {$unwind: '$targetGroup'}, 
        {$group : { _id : '$targetGroup', count : {$sum : 1}}}, 
        function(error, results)
        {
          callback(error, results);
        }
      );
    };

    scope.getFrequencies = function(callback){
      Media.aggregate(
        {$match: {toolId:scope.toolId, "attributes.frequency": { $exists: 1}, isActive : 1}},
        {$group : { _id : '$attributes.frequency.value', count : {$sum : 1}}}, 
        function(error, results)
        {
          callback(error, results);
        }
      );
    };

    scope.getMediaOptions = function(callback){
      //Hardcoding the values for now, as the frequency of changes is very low
      var mediaOptions = [
        {'_id' : 'print', 'name' : 'Print'},
        {'_id' : 'eMail', 'name' : 'EMail'},
        {'_id' : 'website', 'name' : 'Website'}
      ];
      callback(null, mediaOptions);
    };

    scope.getProducts = function(callback){
      Products.find({}, '_id name', function(error, results){
        callback(error, results);
      });
    };

  this.show = function(req, res){
    Media.findOne(
      {urlSlug: req.params.urlSlug}, 
      function(err, results)
      {
        if(!results) res.status(404).json({error : 'No Such Media Found'});
        res.status(200).json({magazine : results});
      }
    );
  }

};

module.exports.Mag = Magazine;