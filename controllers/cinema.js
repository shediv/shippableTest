var Cinema = function()
{
  var async = require('async');
  var underscore = require('underscore');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Category = require('../models/category').Category;
  var Geography = require('../models/geography').Geography;
  var months = ['','january','february','march','april','may','june','july','august','september','october','november','december'];
  var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  
  this.params = {};
  this.toolName = "cinema";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getCinemas = function(req, res){
    self.params = JSON.parse(req.query.geography);      
    if(self.params) 
    {
      var GeographyIDs = [];
      var geoMedias = [];
      var finalData = []; 
      if(self.params.locality){
        async.series({
            geography : function(callback) {
              Geography.aggregate(
                      {$match: {locality:self.params.locality, pincode: { $exists: 1}}},
                      {$group : { _id : '$_id', count : {$sum : 1}}},
                      function(error, results){
                        for(i=0; i<results.length; i++){
                          GeographyIDs.push(results[i]._id);
                        }              
                        callback(error, results);             
                      });
            },
            medias : function(callback) {

              var match = {
                "$match" : {
                  $or: [
                    {"mallName" : "Diamond City Mall"},
                    {"geography" : { $in: GeographyIDs }},
                    {"cinemaChain" : "Chawla Multiplex" }
                  ]
                }
              };

              var group = {
                "$group" : { _id : '$geography', geoBasedMedias:{$push : '$$ROOT'}, count : {$sum : 1}}
              }

              Media.aggregate([match, group], function(err, medias){                                    
                callback(err, medias);
              });   
            }
          }, function(error, results) {
              //Data is all ready sorted based on geography (i.e based on pincode in return)              
              //console.log(results.medias[3].geoBasedMedias.length);
              for(i=0; i<3; i++){
                  geoMedias.push(results.medias[i].geoBasedMedias);
                  for(j=0; j<geoMedias.length; j++){
                    count = 1;
                    if(!geoMedias[j].isSingleScreen){
                      if(count < 3){
                      finalData.push(geoMedias[j]);
                      count++;
                      }
                    }

                    }

                  console.log(geoMedias);
                    
                  }                  
                           
              //return res.status(200).json(results.medias.length);
              return res.status(200).json(finalData);
              //return res.status(200).json({count:results.length,medias:results.medias});
          }
        );

      }
    }  
  };

  this.getFilters = function(req, res){    
    async.parallel({
      mallName: self.getMallName,      
      cinemaChain : self.getCinemaChain,
      screenType : self.getScreenType,
      mediaType : self.getMediaType
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getMallName = function(callback){
      var aggregation = Media.aggregate(
                          {$match: {toolId:self.toolId, "mallName": { $exists: 1}, isActive : 1}},
                          {$group : { _id : '$mallName', count : {$sum : 1}}}
                        ); 
      
      aggregation.options = { allowDiskUse: true }; 
      aggregation.exec(function(error, results) {
        callback(error, results)
      });
    };

    // self.getGeographies = function(callback){
    //   var aggregation = Media.aggregate(
    //                       {$match: {toolId:self.toolId, geography: { $exists: 1}, isActive : 1}},
    //                       {$unwind: '$geography'},
    //                       {$group : { _id : '$geography', count : {$sum : 1}}}
    //                     ); 
      
    //   aggregation.options = { allowDiskUse: true }; 

    //   aggregation.exec(function(error, results) {
    //     var geoIds = [];
    //       results.map(function(o){ geoIds.push(o._id); });
    //       Geography.find({_id : {$in: geoIds}},'name').lean().exec(function(err, geos){
    //         callback(error, geos);
    //       });
    //   });
    // };

    self.getCinemaChain = function(callback){
      var aggregation = Media.aggregate(
                          {$match: {toolId:self.toolId, "cinemaChain": { $exists: 1}, isActive : 1}},
                          {$group : { _id : '$cinemaChain', count : {$sum : 1}}}
                        );

      aggregation.options = { allowDiskUse: true }; 
      aggregation.exec(function(error, results) {
        callback(error, results)
      });
    };

    self.getScreenType = function(callback){
      var ScreenType = [
        {'_id' : 'false', 'name' : 'Multiplex'},
        {'_id' : 'true', 'name' : 'Single Screen'}
      ];
      callback(null, ScreenType);
    };

    self.getMediaType = function(callback){
      var MediaType = [
        {'_id' : 'onScreen', 'name' : 'onScreen'},
        {'_id' : 'offScreen', 'name' : 'offScreen'}
      ];
      callback(null, MediaType);
    };


    /*//................................ test ......................//*/

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
      
    };

  this.getBestrates = function(req, res){
    var medias = {};
    var mediaIds = [];

    for(key in req.body.medias)
    {
      var mediaId = req.body.medias[key]._id;
      var type = req.body.medias[key].type;
      var mediaOption = req.body.medias[key].mediaOption;
      if(medias[req.body.medias[key]._id] === undefined)
      {
        mediaIds.push(mediaId);
        medias[mediaId] = {};
        medias[mediaId]['name'] = req.body.medias[key].name;
        medias[mediaId]['urlSlug'] = req.body.medias[key].urlSlug;
        medias[mediaId]['thumbnail'] = req.body.medias[key].thumbnail;
        medias[mediaId]['logo'] = req.body.medias[key].logo;

        medias[mediaId].mediaOptions = {};
        medias[mediaId].mediaOptions[type] = {};
        medias[mediaId].mediaOptions[type][mediaOption] = {};
        medias[mediaId].mediaOptions[type][mediaOption].qty = 1;
      }
      else
      {
        if(medias[mediaId].mediaOptions[type][mediaOption] === undefined)
        {
          medias[mediaId].mediaOptions[type][mediaOption] = {};
          medias[mediaId].mediaOptions[type][mediaOption].qty = 1;
        }
        else
          medias[mediaId].mediaOptions[type][mediaOption].qty++;
      }
    }

    Media.find({_id : {$in : mediaIds}}, function(err, result){
      result.map(function(media){ 
        for(key in medias[media._id].mediaOptions)
        {
          pricing[media._id][key] = {};
          switch(key)
          {
            case 'print':
              for(mo in medias[media._id].mediaOptions.print)
              {
                medias[media._id][key][mo] = {};
                medias[media._id][key][mo].originalUnitPrice = media.print.mediaOptions[mo].cardRate;

                switch(true)
                {
                  case medias[media._id].mediaOptions.print[mo].qty <= 2:
                    medias[media._id][key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['1-2'];   
                    break;
                  case medias[media._id].mediaOptions.print[mo].qty <= 6:
                    medias[media._id][key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['3-6'];   
                    break;
                  case medias[media._id].mediaOptions.print[mo].qty > 6:
                    medias[media._id][key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['7+'];   
                    break;
                }
                
                medias[media._id][key][mo].originalGrossPrice = medias[media._id][key][mo].originalUnitPrice * medias[media._id].mediaOptions.print[mo].qty;
                medias[media._id][key][mo].discountedGrossPrice = medias[media._id][key][mo].discountedUnitPrice * medias[media._id].mediaOptions.print[mo].qty;
                medias[media._id][key][mo].unitSaving = medias[media._id][key][mo].originalUnitPrice - medias[media._id][key][mo].discountedUnitPrice;
                medias[media._id][key][mo].grossSaving = medias[media._id][key][mo].originalGrossPrice - medias[media._id][key][mo].discountedGrossPrice;
              }
              break;
            case 'website':
              for(mo in medias[media._id].mediaOptions[key])
              {
                medias[media._id][key][mo] = {};
                medias[media._id][key][mo].originalUnitPrice = media[type].mediaOptions[mo].pricing;
                medias[media._id][key][mo].dicsountedUnitPrice = media[type].mediaOptions[mo].pricing;
                medias[media._id][key][mo].originalGrossPrice = medias[media._id][key][mo].originalUnitPrice * medias[media._id].mediaOptions.print[mo].qty;
                medias[media._id][key][mo].discountedGrossPrice = medias[media._id][key][mo].discountedUnitPrice * medias[media._id].mediaOptions.print[mo].qty;
                medias[media._id][key][mo].unitSaving = medias[media._id][key][mo].originalUnitPrice - medias[media._id][key][mo].discountedUnitPrice;
                medias[media._id][key][mo].grossSaving = medias[media._id][key][mo].originalGrossPrice - medias[media._id][key][mo].discountedGrossPrice;
              }
              break;
            case 'email':
              medias[media._id][key][mo] = {};
              medias[media._id][key][mo].originalUnitPrice = media[type].mediaOptions.pricing;
              medias[media._id][key][mo].dicsountedUnitPrice = media[type].mediaOptions.pricing;
              medias[media._id][key][mo].originalGrossPrice = medias[media._id][key][mo].originalUnitPrice * medias[media._id].mediaOptions.print[mo].qty;
              medias[media._id][key][mo].discountedGrossPrice = medias[media._id][key][mo].discountedUnitPrice * medias[media._id].mediaOptions.print[mo].qty;
              medias[media._id][key][mo].unitSaving = medias[media._id][key][mo].originalUnitPrice - medias[media._id][key][mo].discountedUnitPrice;
              medias[media._id][key][mo].grossSaving = medias[media._id][key][mo].originalGrossPrice - medias[media._id][key][mo].discountedGrossPrice;
              break;
          }
        }
        medias[media._id].dates = self.getTenDates(media.timeline.dates, media.attributes.frequency.value);
      });
      res.status(200).json(medias);
    });
  };

    self.getTenDates = function(dates, frequency){
      var pubDates = [];
      var dateObj = new Date();
      var currMonth = dateObj.getMonth();
      var currYear = dateObj.getFullYear();
      
      return self.formDates(pubDates, dates, currMonth, currYear)
    }

    self.formDates = function(pubDates, dates, currMonth, currYear)
    {
      for(key in dates)
      {
        if(months.indexOf(key) < currMonth) continue;
        for(eachDate in dates[key])
        {
          dates[key][eachDate] = trim(dates[key][eachDate]);
          switch(true)
          {
            case dates[key][eachDate] == 'Everyday':
              var dateObj = new Date();
              for(i = 1; i <= 10; i++) pubDates.push( dateObj.setDate( dateObj.getDate() + i ).format("dd-m-yy") );
              break;
            case CommonLib.isNumber(dates[key][eachDate]) == true:
              var dateObj = new Date();
              var cMonth = dateObj.getMonth();
              var cDate = dateObj.getDate();
              var cYear = dateObj.getFullYear();
              dateObj.setMonth(currMonth);
              dateObj.setFullYear(currYear);
              dateObj.setDate( parseInt(dates[key][eachDate]) );
              if(cMonth == dateObj.getMonth() && cYear == dateObj.getFullYear() && cDate <= dateObj.getDate()){}
              else pubDates.push(dateObj.format("dd-m-yy"));
              break;
            case days.indexOf(dates[key][eachDate].toLowerCase()) > -1:
              var dateObj = new Date();
              if(dateObj.getFullYear != currYear) dateObj.setDate(1);
              while(dateObj.getDay() !== 1) dateObj.setDate(dateObj.getDate() + 1);
              while(dateObj.getMonth() === currMonth) 
              {
                pubDates.push(new Date(dateObj.getTime()).format("dd-mm-yy"));
                dateObj.setDate(dateObj.getDate() + 7);
              }
              break;
            default:
              var pubDays = dates[key][eachDate].split(' ');
              var week = ['','first','second','third','fourth'];
              var weekDay = days.indexOf(pubDays[1]);
              var dateObj = new Date();
              var cMonth = dateObj.getMonth();
              var cDate = dateObj.getDate();
              var cYear = dateObj.getFullYear();
              dateObj.setMonth(currMonth);
              dateObj.setFullYear(currYear);
              dateObj.setDate(1);
              while(dateObj.getDay() !== weekDay) dateObj.setDate(dateObj.getDate() + 1);
              dateObj.setDate(dateObj.getDate() + (7 * days.indexOf(pubDays[0])) )
              if(cMonth == dateObj.getMonth() && cYear == dateObj.getFullYear() && cDate <= dateObj.getDate()){}
              else pubDates.push(dateObj.format("dd-m-yy"));
          }
          if(currMonth == 12) {currMonth++; currYear++;}
          else currMonth++;
        }
      }
      if(pubDates.length < 10) pubDates = self.formDates(pubDates, dates, currMonth, currYear);
      return pubDates;
    }
};

module.exports.Cinema = Cinema;