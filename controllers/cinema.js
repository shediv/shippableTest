var Cinema = function()
{
  var async = require('async');
  var underscore = require('underscore');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Category = require('../models/category').Category;
  var Geography = require('../models/geography').Geography;
  var UpcomingMovies = require('../models/upcomingMovies').UpcomingMovies;
  var months = ['','january','february','march','april','may','june','july','august','september','october','november','december'];
  var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  
  this.params = {};
  this.toolName = "cinema";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getCinemas = function(req, res){
    self.params = JSON.parse(req.query.params);                
    async.series([self.buildGeographyQuery], function(err, results){
      return res.status(200).json({media:results[0]});
    });
  };

    self.buildGeographyQuery = function(callbackMain){
      var or = [];
      self.params.geographyIds = [];
      var dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + (12 - dateObj.getDay()) % 7);
      self.params.nextFriday = ('0' + dateObj.getDate()).slice(-2) + '/'
                        + ('0' + (dateObj.getMonth()+1)).slice(-2) + '/'
                        + dateObj.getFullYear();
      if(self.params.filters.geographies === undefined) self.params.filters.geographies = [];
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
          Geography.find(match, function(err, results){
            var geographies = {};
            for(i in results)
            {
              results[i] = results[i].toObject();
              geographies[results[i]._id.toString()] = results[i];
              self.params.geographyIds.push(results[i]._id.toString());
            }
            callbackInner(err, geographies); 
          });
        }
      ],
      function(err, geographies)
      {
        self.buildScreensQuery(err, geographies, callbackMain);
      });
    };

    self.buildScreensQuery = function(err, geographies, callbackMain){ 
      var match = [];
      if(self.params.geographyIds.length) match.push({geography : { $in:self.params.geographyIds }});
      if(self.params.filters.mallName.length) match.push({mallName : { $in:self.params.filters.mallName }});
      if(self.params.filters.cinemaChain.length) match.push({cinemaChain : { $in:self.params.filters.cinemaChain }});
      if(self.params.filters.mediaType == 'onScreen')
        if(self.params.filters.screenType.length) match.push({isSingleScreen : { $in:self.params.filters.screenType }});
      match.push({type : self.params.filters.mediaType });
      match.push({toolId : self.toolId});
      match = {  $match : {  $and: match } };

      var group = {
        "$group" : { _id : '$geography', geoBasedMedias:{$push : '$$ROOT'}, count : {$sum : 1}}
      };
      var project = {
        type : 1,
        mallName : 1,
        cinemaChain : 1,
        seats : 1,
        geography : 1
      };
      
      if(self.params.filters.mediaType == 'onScreen')
        self.fetchOnScreenData(geographies, match, group, project, callbackMain);
      else
        self.fetchOffScreenData(geographies, match, group, project, callbackMain);
    };

    self.fetchOnScreenData = function(geographies, match, group, project, callbackMain){
      project['cinemaName'] = 1;
      project['theatreName'] = 1;
      project['screenNumber'] = 1;
      project['creativeFormat'] = 1;
      project['mediaOptions.10SecMuteSlide.'+self.params.nextFriday] = 1;
      project['mediaOptions.10SecAudioSlide.'+self.params.nextFriday] = 1;
      project['mediaOptions.30SecVideo.'+self.params.nextFriday] = 1;
      project['mediaOptions.60SecVideo.'+self.params.nextFriday] = 1;
      async.parallel({
        allScreens : function(callback){
          Media.aggregate(match, {$project:project}, function(err, medias){
            if(geographies.length) callback(err, self.populateOnScreenData(medias, geographies));
            else
            {
              self.params.geographyIds = [];
              for(i in medias) self.params.geographyIds.push(medias[i].geography);
              Geography.find({ _id:{ $in:self.params.geographyIds } }).lean().exec(function(err, results){
                var geographies = {};
                for(i in results) geographies[results[i]._id.toString()] = results[i];
                callback(err, self.populateOnScreenData(medias, geographies));
              });
            }
          });
        },
        recommendedScreens : function(callback){
          var finalMedias = [];
          Media.aggregate(match, {$project:project}, group, function(err, medias){
            for(key in medias)
            {
              medias[key].geoBasedMedias = medias[key].geoBasedMedias.slice(0,2);                  
              finalMedias = finalMedias.concat(medias[key].geoBasedMedias);
            }                
            if(geographies.length) callback(err, self.populateOnScreenData(finalMedias, geographies));
            else
            {
              self.params.geographyIds = {};
              for(i in medias) self.params.geographyIds.push(medias[i].geography);
              Geography.find({ _id:{ $in:self.params.geographyIds } }).lean().exec(function(err, results){
                var geographies = [];
                for(i in results) geographies[results[i]._id.toString()] = results[i];
                callback(err, self.populateOnScreenData(medias, geographies));
              });
            }
          });
        } 
      },
      function(err, results)
      {
        callbackMain(err, results);
      });  
    }

    self.populateOnScreenData = function(medias, geographies){
      var totalPrice = 0;
      var cities = geographies.length;
      var reach = 0;
      var totalSeats = 0;
      for(i in medias)
      {
        totalPrice += medias[i].mediaOptions['10SecMuteSlide'][self.params.nextFriday].showRate;
        totalSeats += medias[i].seats;
        medias[i]['geographyData'] = {};
        medias[i]['geographyData'] = geographies[0][medias[i].geography];

      }
      var data = {
        count:medias.length, 
        screens:medias, 
        totalPrice:totalPrice, 
        cities:cities, 
        reach:(totalSeats * 4 * 7)
      };

      return data;
    }

    self.fetchOffScreenData = function(geographies, match, group, project, callbackMain){
      project['mediaOptions'] = 1;
      project['dimensions'] = 1;
      Media.aggregate(match, {$project:project}, function(err, medias){
        var totalPrice = 0;
        var cities = geographies.length;
        var reach = 0;
        var totalSeats = 0;
        for(i in medias)
        {
          totalPrice += medias[i].mediaOptions['voucherDistribution'].pricing;
          totalSeats += medias[i].seats;
          medias[i].geographyData = geographies[0][medias[i].geography];
        }      
        callbackMain(err, {
          offScreen : {
            count:medias.length, 
            screens:medias,
            totalPrice:totalPrice, 
            cities:cities, 
            reach:(totalSeats * 4 * 7)
          }
        });
      });
    }

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
        {'_id' : false, 'name' : 'Multiplex', 'selected' : true},
        {'_id' : true, 'name' : 'Single Screen'}
      ];
      callback(null, ScreenType);
    };

    self.getMediaType = function(callback){
      var MediaType = [
        {'_id' : 'onScreen', 'name' : 'On Screen'},
        {'_id' : 'offScreen', 'name' : 'Off Screen'}
      ];
      callback(null, MediaType);
    };

  this.upcomingMovies = function(req, res){
    dateObj = new Date(req.query.date);

    var firstDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    var lastDate = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);

    UpcomingMovies.aggregate(
      {$match : { releaseDate : { $gte:firstDate, $lte:lastDate } }},
      {$sort : {releaseDate:1}},
      {$group : {_id : '$releaseDate', movies:{$push : '$$ROOT'}, count : {$sum : 1}}},
      function(err, results){
        if(err) throw err;
        res.status(200).json({upcomingMovies:results});
      }
    );
  }

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