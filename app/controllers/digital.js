var Digital = function()
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
  
  this.params = {};
  this.toolName = "digital";
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
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
        'geoTargets' : 'geoTagging',
        'languages' : 'language',
        'categories' : 'categoryId',
        'pricingModels' : 'pricingModel',
        'mediums' : 'medium'
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
      var data = []; 
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
            case 'minimumBilling': query.sortBy = {}; break;
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
                
                if(result['mediaOptions'])
                {
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
                  result['firstMediaOption'] = firstmediaOptionsKey;
                }
                Category.findOne({ _id:result.categoryId },'name').lean().exec(function(err, cat){
                  if(cat) result.categoryName = cat.name;
                  callback(err);
                });
              }, function(err){
                if(self.params.sortBy == 'minimumBilling') {
                  results.sort(function(a,b){ return a.minimumBilling - b.minimumBilling });
                  //remove medias with minimumBilling <= 0
                  for(i in results){
                    if(results[i].minimumBilling > 0){
                      data.push(results[i]);
                    }
                  }
                  data = data.slice(self.params.offset, self.params.limit + self.params.offset);
                  callbackInner(err, data);  
                }  
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
      if(err) return res.status(500).json(err);
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
        {'_id' : true, 'name' : 'Geo Targetting Possible'}
        //{'_id' : false, 'name' : 'No'}
      ];
      callback(null, geoTargets);
    };

    self.getPricingModels = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "pricingModel": { $exists: 1} }},
        {$unwind: '$pricingModel'},
        {$group : { _id : '$pricingModel', count : {$sum : 1}}},
        function(err, results) 
        {
          callback(err, results);
        }
      );
    };

    self.getLanguages = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "language": { $exists: 1} }},
        {$group : { _id : '$language', count : {$sum : 1}}},
        function(err, results) 
        {
          callback(err, results);
        }
      );
    };

  this.show = function(req, res){
    //req.params.urlSlug = decodeURI(req.params.urlSlug);
    Media.findOne({urlSlug: req.params.urlSlug, toolId : self.toolId, isActive:1}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      Category.findOne({ _id:results.categoryId },'name').lean().exec(function(err, cat){
        if(cat) results.categoryName = cat.name;
        var newTitle = results.name.replace("App", '');
        newTitle = newTitle.replace("  ", " ");
        var Title = newTitle + ' ' +results.medium;
        newTitle = Title + ' Advertising >> Rates for '+Title+' Advertisement';
        keyWords= ['cost per click', 'cost per mille', 'cost per action', 'cost per like', 'cost per customer', 'cost per engagement', 'bidding', 'cost per view', 'CPA', 'CPC', 'CPM', 'CPV', 'cost per thousand impressions', 'video ads', Title+ ' advertising rates', Title+  ' ad rates', Title+  ' media kit', Title+  ' card rates', Title+ ' advertising', Title+  ' advertising details', Title+  ' pricing details', 'how to advertise in ' +Title, Title+  'media rates', Title+  ' advertising manager', Title+  ' contact details', Title+  ' advertising contact', Title+  ' media contact', 'ad spots'];
        var metaTags = {
          title : newTitle,
          image  : results.imageUrl,
          //description  : results.about,
          description  : Title + ' Advertising is utilized by variety of brands to  reach out to their target audience. You can explore '+Title+' Advertising rates and '+Title+' Advertising cost here.',
          facebook : self.config.facebook,
          twitter : self.config.twitter,
          keyWords : keyWords
        }
        res.status(200).json({digital : results, metaTags : metaTags});
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

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = CompareProject[self.toolName];
    
    Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
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