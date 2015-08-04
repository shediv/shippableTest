var Magazine = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;

  this.params = {};
  this.toolName = "magazine";
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
      for(key in result.magazines)
        result.magazines[key].attributes = CommonLib.removeHiddenAttributes(result.magazines[key].attributes);
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
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, results)
      {
        if(!results) res.status(404).json({error : 'No Such Media Found'});
        results.attributes = CommonLib.removeHiddenAttributes(results.attributes);
        res.status(200).json({magazine : results});  
      }
    );
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'name' : 1,
      'urlSlug' : 1,
      'thumbnail' : 1,
      'targetGroup' : 1,
      'categoryId' : 1,
      'attributes.frequency.value' : 1,
      'attributes.language.value' : 1,
      'attributes.targetGroup' : 1,
      'attributes.readership.value' : 1,
      'attributes.circulation.value' : 1,
      'print.mediaOptions.fullPage.1-2' : 1,
      'IRS' : 1,
      'digital' : 1
    };
    async.series({
      medias :  function(callback){
                  Media.find({_id: { $in: ids }}, project,function(err, results){
                    var medias = results.map(function(m){
                      catIds.push(m.categoryId);
                      return m.toObject();
                    });
                    callback(err, medias);
                  });
                },
      categories : function(callback){ CommonLib.getCategoryName(catIds, callback) },
    }, 
    function(err, result)
    {
      for(var i = 0; i < result.medias.length; i++)
      {
        result.medias[i].categoryName = result.categories[result.medias[i].categoryId];
        result.medias[i].frequency = result.medias[i].attributes.frequency.value;
        result.medias[i].language = result.medias[i].attributes.language.value;
        result.medias[i].circulation = result.medias[i].attributes.circulation.value;
        result.medias[i].readership = result.medias[i].attributes.readership.value;
        result.medias[i].fullPage = result.medias[i].print.mediaOptions.fullPage['1-2'];
        result.medias[i].website = result.medias[i].digital;
        delete result.medias[i].digital;
        delete result.medias[i].attributes;
        delete result.medias[i].print;
      }
      res.status(200).json({magazines:result.medias});
    });
  };

  this.relatedMedia = function(req, res){
    //Query for maxReadership, maxNoOfPages, minFullPage
    Media.aggregate(
      {
        $match : {
          categoryId : req.params.categoryId,
          toolId : scope.toolId,
          isActive: 1,
          urlSlug : { $ne : req.query.urlSlug }
        }
      },
      {
        $project : {
          urlSlug : 1, 
          name: 1, 
          thumbnail : 1, 
          attributes : 1, 
          categoryId : 1, 
          _id : 1, 
          'print.mediaOptions.fullPage.1-2' : 1
        }
      },
      function(err, results)
      {
        scope.yForumala(results, function(err, results){
          res.status(200).json({magazines: results});
        });
      }
    );
  }

    scope.yForumala = function(medias, callback){
      //Query for maxReadership, maxNoOfPages, minFullPage
      Media.aggregate(
        {
          $match : {
            categoryId : medias[0].categoryId,
            toolId : scope.toolId,
            isActive: 1
          }
        },  
        {
          $group: {
            _id: "$categoryId",
            maxReadership: { $max: "$attributes.readership.value" },
            maxNoOfPages: { $max: "$attributes.noOfPages.value" },
            minFullPage: { $min: "$print.mediaOptions.fullPage.1-2" }
          }
        }, 
        function(err, results)
        {
          // Assign maxReadership, maxNoOfPages, minFullPage
          var maxReadership = results[0].maxReadership;
          var maxNoOfPages = results[0].maxNoOfPages;
          var minFullPage = results[0].minFullPage;

          medias.map(function(o){ 
            x = ( (o.attributes.noOfPages.value * 10)/maxNoOfPages ) * 0.3;
            y = ( (o.attributes.readership.value * 10)/maxReadership ) * 0.1;
            z = ( (minFullPage * 10)/o.print.mediaOptions.fullPage['1-2'] ) * 0.6;
            o.yValue = x + y + z;
          });

          medias.sort(function(mediaA, mediaB){
            return mediaB.yValue - mediaA.yValue;
          })

          medias = [medias[0],medias[1],medias[2]];
          
          callback(err, medias);
        }
      );
    }

};

module.exports.Mag = Magazine;