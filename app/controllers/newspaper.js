var Newspaper = function()
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
  var RelatedProject = require('../config/relatedProject.js');
  
  this.params = {};
  this.toolName = "newspaper";
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
  var self = this;
  
  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });
  
  this.getNewspapers = function(req, res){
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function(callback)
      {
        callback(null, self.applyFilters());
      },
      function(query, callback)
      {
        if(self.params.recommended) return self.newsPaperRecommend(self.params,callback);
        self.sortFilteredMedia(query, callback);
      }
    ],
    function (err, result)
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({medias:result.medias, count:result.count});
    });
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};
      var filters = {
        'categories'  : 'categoryId',
        'areas'       : 'areaCovered',
        'languages'   : 'language',
        'frequencies' : 'frequency'
      };
      query.projection = ToolsProject[self.toolName];

      Object.keys(filters).map(function(value){
        if(self.params.filters[value].length)
          query.match[filters[value]] = {'$in': self.params.filters[value]};
      });
      
      if(self.params.filters["type"]) query.match.newspaperType = self.params.filters["type"];
      query.match.isActive = 1;
      query.match.toolId = self.toolId;
      return query;
    };

    self.sortFilteredMedia = function(query, callback){
      async.parallel({
        count : function(callbackInner)
        {          
          Media.count(query.match,
            function(err, count)
            {
              callbackInner(err, count);
            }
          );
        },
        medias : function(callbackInner)
        {          
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
            case 'circulation': query.sortBy = { 'circulation' : -1}; break;
            case 'rate': query.sortBy = { 'mediaOptions.regularOptions.anyPage.<800SqCms.cardRate' : 1}; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
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

    self.newsPaperRecommend = function(query, callback){
      var categoryId = "";
      query.match = {};
      query.sortBy = {};
      query.groupBy={};
      query.filters={};
      async.waterfall([
        function(callbackInner)
        {
          Category.findOne({ name:'General Interest'},'_id').lean().exec(function(err, cat){
            categoryId = cat._id.toString();
            callbackInner(err, categoryId);
          });
        },
        function(categoryId, callbackInner)
        {
          Products.findOne({ _id:self.params.productId },{ newspaper:1 }).lean().exec(function(err, result){
            var categoryIds = [];
            if(result.newspaper.categoryIds.indexOf(categoryId) == -1)
            {
              for(i in result.newspaper.categoryIds) categoryIds[i] = result.newspaper.categoryIds[i].toString();
              categoryIds.push(categoryId);
            }
            
            callbackInner(err, categoryIds);
          });
        },
        function(categoryIds, callbackInner)
        { 
          query.match['toolId']= self.toolId;
          query.match['isActive']= 1;
          query.match['geography'] = query.geography;
          query.match['categoryId'] = { $in : categoryIds };
          callbackInner(null, query);
        }
      ],
      function(err, query)
      { 
        Media.aggregate(
          { $match: query.match },
          { $project : {  '_id'                 : 1,
                          'urlSlug'             : 1,
                          'name'                : 1,
                          'editionName'         : 1,
                          'areaCovered'         : 1,
                          'circulation'         : 1,
                          'language'            : 1,
                          'geography'           : 1,
                          'mediaOptions.anyPage': 1,        
                          'logo'                : 1,
                          'categoryId'          : 1, 
                        } 
          },
          { $sort :  { circulation : -1 } },
          { $group:  {count : {$sum : 1}, _id : "$categoryId",newsPaper:{ $push :'$$ROOT' }}},
          function(err,results)
          {
            var paperRecommend=[];
            var productDataCount=0; 

            for(i in results)
            {
              if(results[i]._id == categoryId)
              {   
                results[i].newsPaper = results[i].newsPaper.slice(0,2);
                paperRecommend = paperRecommend.concat(results[i].newsPaper);
              }
              else
              {
                results[i].newsPaper = results[i].newsPaper.slice(0,1);
                paperRecommend = paperRecommend.concat(results[i].newsPaper);
              }
              var productDataCount =productDataCount + results[i].newsPaper.length;     

            }
            callback(err,{count:productDataCount,medias:paperRecommend});
          }   
        );
      });
    }

  this.getFilters = function(req, res){
    async.parallel({
      categories : self.getCategories,
      areas : self.getAreas,
      languages : self.getLanguages,
      frequencies : self.getFrequencies,
      types : self.getNewspaperTypes,
      products  : self.getProducts,
      geographies  : self.getGeographies
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getCategories = function(callback){
      Media.distinct('categoryId',
        { toolId:self.toolId},
        function(err, categoryIds) 
        {
          Category.find({_id : {$in: categoryIds}},'name').lean().exec(function(err, cats){
            callback(err, cats);
          });
        }
      );
    };

    self.getAreas = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "areaCovered": { $exists: 1} }},
        {$group : { _id : '$areaCovered', count : {$sum : 1}}},
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

    self.getFrequencies = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "frequency": { $exists: 1} }},
        {$group : { _id : '$frequency', count : {$sum : 1}}},
        function(err, results) 
        {
          callback(err, results);
        }
      );
    };

    self.getNewspaperTypes = function(callback){
      var ScreenType = [
        {'_id' : 'supplement', 'name' : 'Supplement'},
        {'_id' : 'main', 'name' : 'Main'}
      ];
      callback(null, ScreenType);
    };

    self.getProducts = function(callback){
      Products.find({}, '_id name', function(err, results){
        callback(err, results);
      });
    };

    self.getGeographies = function(callback){
      Media.distinct('geography',
        { toolId:self.toolId , isActive:1 },
        function(err, geographyIds) 
        {
          Geography.find({_id : {$in: geographyIds}},'city').lean().exec(function(err, geos){
            callback(err, geos);
          });
        }
      );
    };

  this.show = function(req, res){
    //req.params.urlSlug = decodeURI(req.params.urlSlug);
    Media.findOne({urlSlug: req.params.urlSlug, toolId : self.toolId, isActive:1}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      Category.findOne({ _id:results.categoryId },'name').lean().exec(function(err, cat){
        if(cat) results['categoryName'] = cat.name;
        keyWords = [results.name+' Newspaper in '+results.areaCovered+' advertising rates', 'ad rates', 'media kit', 'card rates', 'advertisement', 'advertising details', 'pricing details', 'how to advertise in '+results.name+' Newspaper', 'media rates', 'advertising manager', 'contact details', 'advertising contact', 'media contact', 'frequency', 'circulation'];
        if(results.about) {
          description = results.about;
        }else {
          description =  results.name+' Newspaper Advertising is utilized by a variety of brands to reach the target audience. '+results.name+' that covers '+results.areaCovered+' is a popular newspaper in the '+results.categoryName+' Segment. Due to a low cost of distribution and high readership, '+results.name+' Newspapers Advertising Rates have a low CPM. You can explore '+results.name+ ' Newspaper Advertising Rates & '+results.name+' Newspaper Advertising Costs here';
        }
        var metaTags = {
          title : results.name+ ' Newspaper Advertising in '+results.areaCovered+' >> Rates for '+results.name+' Newspaper Advertisement in '+results.areaCovered,
          image  : results.imageUrl,
          description  : description,
          facebook : self.config.facebook,
          twitter : self.config.twitter,
          keyWords : keyWords          
        }
        res.status(200).json({newspaper : results, metaTags:metaTags});
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
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = CompareProject[self.toolName];
    
    async.series({
      medias : function(callback){
        Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
          var medias = results.map(function(m){
            catIds.push(m.categoryId);
            return m;
          });
          callback(err, medias);
        });
      },
      categories : function(callback){ CommonLib.getCategoryName(catIds, callback) },
    },
    function(err, result)
    {
      if(err) return res.status(500).json(err);
      for(i in result.medias)
      {
        result.medias[i].categoryName = result.categories[result.medias[i].categoryId];
      }
      res.status(200).json({medias:result.medias});
    });
  };

  this.relatedMedia = function(req, res){
    Media.aggregate(
      {
        $match : {
          categoryId : req.params.categoryId,
          geography : req.query.geography,
          toolId : self.toolId,
          isActive: 1,
          urlSlug : { $ne : req.query.urlSlug }
        }
      },
      {
        $sort : {
          circulation : -1,
        }
      },
      {$skip : 0}, {$limit: 3},
      {
        $project : RelatedProject[self.toolName]
      },
      function(err, results)
      {
        if(err) return res.status(500).json(err);
        res.status(200).json({medias:results});
      }
    );
  };
};

module.exports.Newspaper = Newspaper;