var Newspaper = function()
{
  var async = require('async');
  var underscore = require('underscore');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  var week = ['first','second','third','fourth'];
  var dayConversion = (24 * 60 * 60 * 1000);
  
  this.params = {};
  this.toolName = "newspaper";
  var self = this;
  this.toolId='';
  
  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });
  


  this.getNewspapers = function(req, res){    
    self.params = JSON.parse(req.query.params);
    //return res.status(200).json(self.params);
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
      query.projection = {
        '_id'                 : 1,
        'urlSlug'             : 1,
        'name'                : '$newspaperName',
        'editionName'         : 1,
        'areaCovered'         : 1,
        'circulation'         : 1,
        'language'            : 1,
        'geography'           : 1,
        'mediaOptions.anyPage': 1,        
        'logo'                : 1
      };

      Object.keys(filters).map(function(value){
        if(self.params.filters[value].length)
          query.match[filters[value]] = {'$in': self.params.filters[value]};
      });
      console.log(query.match);
      process.exit();

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
            function(err, result)
            {
              if(!result) count = 0;
              else count = result[0].count;
              callbackInner(err, result);
            }
          );
        },
        medias : function(callbackInner)
        {          
          switch(query.sortBy)
          {
            case 'topSearched': query.sortBy = { 'views' : -1 }; break;
            case 'circulation': query.sortBy = { 'circulation' : -1}; break;
            case 'rate': query.sortBy = { 'mediaOptions.anyPage.<800SqCms.cardRate' : -1}; break;
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
      var categoryId ="55d70b748ead0e960c8b4567"; //General interest categoryid
      query.match = {};
      query.sortBy = {};
      query.groupBy={};
      query.filters={};
      async.waterfall([
        function(callbackInner)
        {
          Products.findOne({ _id:self.params.productId },{ newspaper:1 }).lean().exec(function(err, result){
          if(result.newspaper.categoryIds.indexOf('55d70b748ead0e960c8b4567') == -1)
            {
             result.newspaper.categoryIds.push('55d70b748ead0e960c8b4567'); 
            }  
            callbackInner(err, result.newspaper.categoryIds);
          });
        },
        function(productData,callbackInner)
        { 
          query.match['toolId']= self.toolId;
          query.match['isActive']= 1;
          query.match['geography'] = query.geographyId;
          query.match['categoryId'] = { $in : productData };
          callbackInner(null, query);
        }
      ],
      function(err, query)
      { 
        Media.aggregate(
          { $match: query.match },
          { $project : {  '_id'                 : 1,
                          'urlSlug'             : 1,
                          'name'       : '$newspaperName',
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
          function(err,results){
            var paperRecommend=[];
            var productDataCount=0; 
            console.log(results.length);
            for(var i=0; i<results.length;i++){
                if(results[i]._id == categoryId)
                  {   
                      paperRecommend.push(results[i].newsPaper[0]);
                      paperRecommend.push(results[i].newsPaper[1]);
                  }
                  else{
                    paperRecommend.push(results[i].newsPaper[0]);
                }
            var productDataCount =productDataCount + results[i].newsPaper.length;     
            }
          callback(err,{count:productDataCount,media:paperRecommend});
          }   
        );
      });
    }

  this.getFilters = function(req, res){
    async.parallel({
      categories : self.getCategories,
      areas : self.getAreas,
      languages : self.getLanguages,
      frequencies : self.getFrequency,
      types : self.getNewspaperType,
      products  : self.getProducts
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getCategories = function(callback){
      Media.distinct('categoryId',
        { toolId:self.toolId},
        function(error, categoryIds) 
        {
          Category.find({_id : {$in: categoryIds}},'name').lean().exec(function(err, cats){
            callback(error, cats);
          });
        }
      );
    };

    self.getAreas = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "areaCovered": { $exists: 1} }},
        {$group : { _id : '$areaCovered', count : {$sum : 1}}},
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

    self.getFrequency = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "frequency": { $exists: 1} }},
        {$group : { _id : '$frequency', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getNewspaperType = function(callback){
      var ScreenType = [
        {'_id' : 'supplement', 'name' : 'Supplement'},
        {'_id' : 'main', 'name' : 'Main'}
      ];
      callback(null, ScreenType);
    };

    self.getProducts = function(callback){
      Products.find({}, '_id name', function(error, results){
        callback(error, results);
      });
    };

  this.show = function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, results)
      {
        if(!results) res.status(404).json({error : 'No Such Media Found'});
        Geography.findOne()
        res.status(200).json({newspaper : results});        
      }
    );
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'urlSlug' : 1,
      'name'       : '$newspaperName',
      'editionName' : 1,
      'circulation' : 1,
      'areaCovered' : 1,
      'categoryId' :1,
      'language' : 1,
      'mediaOptions.anyPage.<800SqCms.cardRate' : 1,        
      'logo' : 1
    };
    
    async.series({
      medias : function(callback){
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
          //isActive: 1,
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
        $project : {
          '_id' : 1,
          'urlSlug' : 1,
          'name'       : '$newspaperName',
          'editionName' : 1,
          'circulation' : 1,
          'areaCovered' : 1,
          'language' : 1,
          'urlSlug' : 1,
          'mediaOptions.anyPage.<800SqCms.cardRate' : 1,        
          'logo' : 1
        }
      },
      function(err, results)
      {
        res.status(200).json({medias:results});
      }
    );
  };

  this.getBestRates = function(req, res){
    var medias = req.body.medias;
    var mediaIds = [];
    for(key in medias) mediaIds.push(key);

    Media.find({_id : {$in : mediaIds}}, function(err, result){
      totalGrossPrice = 0;
      totalGrossSaving = 0;
      result.map(function(media){ 
        media = media.toObject();
        for(key in medias[media._id].mediaOptions)
        {
          switch(key)
          {
            case 'print':
              for(mo in medias[media._id].mediaOptions.print)
              {
                medias[media._id].mediaOptions[key][mo].originalUnitPrice = media.print.mediaOptions[mo].cardRate;

                switch(true)
                {
                  case medias[media._id].mediaOptions.print[mo].qty <= 2:
                    medias[media._id].mediaOptions[key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['1-2'];   
                    break;
                  case medias[media._id].mediaOptions.print[mo].qty <= 6:
                    medias[media._id].mediaOptions[key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['3-6'];   
                    break;
                  case medias[media._id].mediaOptions.print[mo].qty > 6:
                    medias[media._id].mediaOptions[key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['7+'];   
                    break;
                }
                
                medias[media._id].mediaOptions[key][mo].originalGrossPrice = medias[media._id].mediaOptions[key][mo].originalUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
                medias[media._id].mediaOptions[key][mo].discountedGrossPrice = medias[media._id].mediaOptions[key][mo].discountedUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
                medias[media._id].mediaOptions[key][mo].unitSaving = medias[media._id].mediaOptions[key][mo].originalUnitPrice - medias[media._id].mediaOptions[key][mo].discountedUnitPrice;
                medias[media._id].mediaOptions[key][mo].grossSaving = medias[media._id].mediaOptions[key][mo].originalGrossPrice - medias[media._id].mediaOptions[key][mo].discountedGrossPrice;
                totalGrossPrice = totalGrossPrice + medias[media._id].mediaOptions[key][mo].discountedGrossPrice;
                totalGrossSaving = totalGrossSaving + medias[media._id].mediaOptions[key][mo].grossSaving;
              }
              break;
            case 'website':
              for(mo in medias[media._id].mediaOptions[key])
              {
                medias[media._id].mediaOptions[key][mo].originalUnitPrice = media[key].mediaOptions[mo].pricing;
                medias[media._id].mediaOptions[key][mo].dicsountedUnitPrice = media[key].mediaOptions[mo].pricing;
                medias[media._id].mediaOptions[key][mo].originalGrossPrice = medias[media._id].mediaOptions[key][mo].originalUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
                //..............
                //console.log(medias[media._id].mediaOptions[key][mo].dicsountedUnitPrice , medias[media._id].mediaOptions[key][mo].qty);
                //console.log('multiply - ',medias[media._id].mediaOptions[key][mo].dicsountedUnitPrice * medias[media._id].mediaOptions[key][mo].qty);
                medias[media._id].mediaOptions[key][mo].discountedGrossPrice = medias[media._id].mediaOptions[key][mo].dicsountedUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
                //console.log(medias[media._id].mediaOptions[key][mo].dicsountedUnitPrice , medias[media._id].mediaOptions[key][mo].qty);
                //console.log(medias[media._id].mediaOptions[key][mo].originalUnitPrice - medias[media._id].mediaOptions[key][mo].discountedUnitPrice);
                medias[media._id].mediaOptions[key][mo].unitSaving = medias[media._id].mediaOptions[key][mo].originalUnitPrice , medias[media._id].mediaOptions[key][mo].discountedUnitPrice;
                //medias[media._id].mediaOptions[key][mo].discountedGrossPrice = medias[media._id].mediaOptions[key][mo].discountedUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
                //medias[media._id].mediaOptions[key][mo].unitSaving = medias[media._id].mediaOptions[key][mo].originalUnitPrice - medias[media._id].mediaOptions[key][mo].discountedUnitPrice;
                medias[media._id].mediaOptions[key][mo].grossSaving = medias[media._id].mediaOptions[key][mo].originalGrossPrice - medias[media._id].mediaOptions[key][mo].discountedGrossPrice;
                //console.log(medias[media._id].mediaOptions[key][mo]);
                totalGrossPrice = totalGrossPrice + medias[media._id].mediaOptions[key][mo].discountedGrossPrice;
                totalGrossSaving = totalGrossSaving + medias[media._id].mediaOptions[key][mo].grossSaving;
              }
              break;
            case 'email':
              medias[media._id].mediaOptions[key][mo].originalUnitPrice = media[key].mediaOptions.pricing;
              medias[media._id].mediaOptions[key][mo].dicsountedUnitPrice = media[key].mediaOptions.pricing;
              medias[media._id].mediaOptions[key][mo].originalGrossPrice = medias[media._id].mediaOptions[key][mo].originalUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
              medias[media._id].mediaOptions[key][mo].discountedGrossPrice = medias[media._id].mediaOptions[key][mo].discountedUnitPrice * medias[media._id].mediaOptions[key][mo].qty;
              medias[media._id].mediaOptions[key][mo].unitSaving = medias[media._id].mediaOptions[key][mo].originalUnitPrice - medias[media._id].mediaOptions[key][mo].discountedUnitPrice;
              medias[media._id].mediaOptions[key][mo].grossSaving = medias[media._id].mediaOptions[key][mo].originalGrossPrice - medias[media._id].mediaOptions[key][mo].discountedGrossPrice;
              totalGrossPrice = totalGrossPrice + medias[media._id].mediaOptions[key][mo].discountedGrossPrice;
              totalGrossSaving = totalGrossSaving + medias[media._id].mediaOptions[key][mo].grossSaving;
              break;
          }
        }
        medias[media._id].dates = self.getTenDates(media.timeline.dates, media.attributes.frequency.value);
      });
      res.status(200).json({
        bestrates:medias,
        totalGrossPrice:totalGrossPrice,
        totalGrossSaving:totalGrossSaving
      });
    });
  };

    self.getTenDates = function(dates, frequency){
      var pubDates = [];
      var dateObj = new Date();
      var currMonth = dateObj.getMonth();
      var currYear = dateObj.getFullYear();
      
      return self.formDates(pubDates, dates, currMonth, currYear, frequency)
    }

    self.formDates = function(pubDates, dates, currMonth, currYear, frequency)
    {
      for(key in dates)
      {
        currMonth = months.indexOf(key);
        for(eachDate in dates[key])
        {
          dates[key][eachDate] = dates[key][eachDate].trim();
          switch(true)
          {
            case dates[key][eachDate] == 'Everyday':
              for(i = 1; i <= 10; i++) 
              {
                var dateObj = new Date();
                dateObj.setHours(0,0,0,0);
                dateObj.setDate( dateObj.getDate() + i );
                pubDates.push(dateObj);
              }
              break;
            case CommonLib.isNumber(dates[key][eachDate]) == true:
              var dateObj = new Date();
              dateObj.setHours(0,0,0,0);
              dateObj.setFullYear(currYear);
              dateObj.setMonth(currMonth);
              dateObj.setDate( parseInt(dates[key][eachDate]) );
              var daysDiff = parseInt( (dateObj - new Date()) / dayConversion );
              if( daysDiff > 0 )pubDates.push(dateObj);
              break;
            case days.indexOf(dates[key][eachDate].toLowerCase()) > -1:
              var dateObj = new Date();
              dateObj.setHours(0,0,0,0);
              dateObj.setFullYear(currYear);
              dateObj.setMonth(currMonth);
              var weekDay = days.indexOf(dates[key][eachDate].toLowerCase());
              dateObj.setDate(1);
              while(dateObj.getDay() !== weekDay) dateObj.setDate(dateObj.getDate() + 1);
              while(dateObj.getMonth() === currMonth) 
              {
                var daysDiff = parseInt( (dateObj - new Date()) / dayConversion ); 
                if( daysDiff > 0 ) pubDates.push(new Date(dateObj.getTime()));
                dateObj.setDate(dateObj.getDate() + 7);
              }
              break;
            default:
              var pubDays = dates[key][eachDate].split(' ');
              var weekDay = days.indexOf(pubDays[1].toLowerCase());
              var dateObj = new Date();
              dateObj.setHours(0,0,0,0);  
              dateObj.setMonth(currMonth);
              dateObj.setFullYear(currYear);
              dateObj.setDate(1);
              while(dateObj.getDay() !== weekDay) dateObj.setDate(dateObj.getDate() + 1);
              dateObj.setDate(dateObj.getDate() + (7 * week.indexOf(pubDays[0].toLowerCase())) )
              var daysDiff = parseInt( (dateObj - new Date()) / dayConversion );
              if( daysDiff > 0 ) pubDates.push(dateObj);
          }
          if(pubDates.length >= 10) return pubDates;
        }
      }
      
      currYear++;
      if(pubDates.length < 10)
        pubDates = self.formDates(pubDates, dates, currMonth, currYear, frequency);
      return pubDates;
    }
};




module.exports.Newspaper = Newspaper;