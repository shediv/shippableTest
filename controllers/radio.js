var Radio = function()
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
  this.toolName = "radio";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getRadios = function(req, res){
    //res.status(200).json("{media:results[0]}");
     self.params = JSON.parse(req.query.params);
     self.sortBy = JSON.parse(req.query.params);

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
        // for(key in result.magazines)
        //   result.magazines[key].attributes = CommonLib.removeHiddenAttributes(result.magazines[key].attributes);
        // res.status(200).json(result);
      });
    
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};
      var filters = {
        'city' : 'city',
        'language' : 'language',
        'station' : 'station'
      };
      query.projection = {
        '_id' : 1,
        'station' : 1,
        'city' : 1,
        'frequency' : 1,
        'language' : 1,
        'mediaOptions' : 1,
        'logo' : 1
      };

      Object.keys(filters).map(function(value){
        if(self.params.filters[value].length)
          query.match[filters[value]] = {'$in': self.params.filters[value]};
      });

      //query.match.isActive = 1;
      //query.match.toolId = self.toolId;
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
              callbackInner(err, result);
            }
          );
        },
        radios : function(callbackInner)
        {
          switch(self.sortBy)
          {
            //case 'topSearched': query.sortBy = { 'topSearched' : -1 }; break;
            //case 'rate10sec': query.sortBy = { 'rate10sec' : -1}; break;
            case 'city': query.sortBy = { 'city' : -1}; break;            
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, //{$sort: query.sortBy},
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

  this.getFilters = function(req, res){
    async.parallel({
      cities: self.getCities,
      stations : self.getStations,
      musiclanguages : self.getMusicLanguages
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getCities = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "city": { $exists: 1} }},
        {$group : { _id : '$city', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getMusicLanguages = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "language": { $exists: 1} }},
        {$group : { _id : '$language', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getStations = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "station": { $exists: 1} }},
        {$group : { _id : '$station', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
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
        results.attributes = CommonLib.removeHiddenAttributes(results.attributes);
        Category.findOne({ _id : results.categoryId },'name').lean().exec(function(err, category){
          results['categoryName'] = category.name;
          res.status(200).json({magazine : results});
        });
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
    var catIds = [];

    async.series({
      medias : function(callback){
        Media.aggregate(
          {
            $match : {
              categoryId : req.params.categoryId,
              toolId : self.toolId,
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
              logo: 1,
              'print.mediaOptions.fullPage.1-2' : 1
            }
          },
          function(err, results)
          {
            self.yForumala(results, function(err, results){
              results.map(function(m){
                catIds.push(m.categoryId);
              });
              callback(err, results)       
            });
          }
        );
      },
      categories : function(callback){ CommonLib.getCategoryName(catIds, callback) },
    },
    function(err, result)
    {
      for(var i = 0; i < result.medias.length; i++)
      {
        result.medias[i].categoryName = result.categories[result.medias[i].categoryId];
      }
      res.status(200).json({magazines:result.medias});
    });
  };

    self.yForumala = function(medias, callback){
      //Query for maxReadership, maxNoOfPages, minFullPage
      Media.aggregate(
        {
          $match : {
            categoryId : medias[0].categoryId,
            toolId : self.toolId,
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

          var topMedias = [];
          for(var i=0; i< 3; i++)
          {
            if(medias[i] != undefined) topMedias.push(medias[i]);
          }
          callback(err, topMedias);
        }
      );
    };

    self.top3= function(query,callback){
      var magazines = [];
      var magazine=[];
      Media.aggregate(
        {$match: query.match},
        {$project: query.projection},
        {$group: {_id: '$categoryId', medias:{$push : '$$ROOT'},count:{$sum:1}}}, 
        function(err, results)
        {
          async.each(results, function (group ,callback_each){
            self.yForumala(group.medias, function (err, res){
              for(var i=0; i < res.length; i++)
                magazines.push(res[i]);    
              callback_each(err);
            });
          },
          function(err)
          {
            var categoryIds=[];
            for(var i=0 ;i<magazines.length ; i++)
              categoryIds.push(magazines[i].categoryId);
            CommonLib.getCategoryName(categoryIds, function(err, catNames){
              for(var i=0; i<magazines.length;i++)
                magazines[i].categoryName = catNames[magazines[i].categoryId];
              switch(query.sortBy)
              {
                case "views":
                  magazines.sort(function(a ,b){
                    return a.views > b.views;
                  });
                  break;
                case "price":
                  magazines.sort(function(a ,b){
                    return a.print.mediaOptions.fullPage['1-2'] < b.print.mediaOptions.fullPage['1-2'];
                  });
                  break;
                case "circulation":
                  magazines.sort(function(a ,b){
                    return a.attributes.circulation.value > b.attributes.circulation.value;
                  });
                  break;
                  case "category":
                    magazines.sort(function(a ,b){
                      return a.categoryName < b.categoryName;
                    });
                    break;
              }
              if(magazines.length>query.offset) {
                for (var i = query.offset; i<(query.offset + query.limit); i++) {
                  if(magazines[i] != undefined) {
                    magazine.push(magazines[i]);
                  }
                }
              }
              else{
                callback(null, {magazines: magazines,count:magazines.length});
              }
              callback(null, {magazines:magazine,count:magazines.length});


            });
          });
        }
      );
    };

  this.getBestRates = function(req, res){
    var medias = req.body.medias;//{};
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




module.exports.Radio = Radio;