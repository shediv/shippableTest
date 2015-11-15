var Cinema = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Category = require('../models/category').Category;
  var Geography = require('../models/geography').Geography;
  var UpcomingMovies = require('../models/upcomingMovies').UpcomingMovies;
  var ToolsProject = require('../config/toolsProject.js');
  
  this.params = {};
  this.toolName = "cinema";
  var self = this;

  this.params = {};
  this.config = require('../config/config.js');
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });
  
  this.getCinemas = function(req, res){
    self.params = JSON.parse(req.query.params);                
    async.series([self.buildGeographyQuery], function(err, results){
      if(err) return res.status(500).json(err);
      var count = 0;
      var medias = [];
      if(results[0].allScreens !== undefined) {count+=results[0].allScreens.count; medias = results[0].allScreens.screens;/*delete results[0].allScreens.screens;*/}
      if(results[0].recommendedScreens !== undefined) {count+=results[0].recommendedScreens.count; medias = results[0].recommendedScreens.screens;/*delete results[0].recommendedScreens.screens;*/}
      if(results[0].offScreen !== undefined) {count+=results[0].offScreen.count; medias = results[0].offScreen.screens;/*delete results[0].offScreen.screens;*/}
      res.status(200).json({medias:medias,count:count,nextDate:self.params.nextFriday});
    });
  };

  this.showCinemas = function(req, res){
    self.params = JSON.parse(req.query.params);                
    async.series([self.buildGeographyQuery], function(err, results){
      if(err) return res.status(500).json(err);
      var count = 0;
      if(results[0].allScreens !== undefined) {count+=results[0].allScreens.count;}
      if(results[0].recommendedScreens !== undefined) {count+=results[0].recommendedScreens.count;}
      if(results[0].offScreen !== undefined) {count+=results[0].offScreen.count;}
      res.status(200).json({medias:results[0],count:count});
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
      if(!self.params.filters.geographies.length)
      {
       delete self.params.filters.geographies;
       return self.buildScreensQuery([], callbackMain); 
      }
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
          Geography.distinct('pincode', match, function(err, pincodes){
            Geography.find({pincode:{$in:pincodes}}).lean().exec(function(err, results){
              var geographies = [];
              if(!results) return callbackInner(err, geographies);
              for(i in results)
              {
                geographies[results[i]._id.toString()] = results[i];
                self.params.geographyIds.push(results[i]._id.toString());
              }
              callbackInner(err, geographies); 
            });
          });
        }
      ],
      function(err, geographies)
      {
        if(err) console.log(err);
        self.buildScreensQuery(geographies[0], callbackMain);
      });
    };

    self.buildScreensQuery = function(geographies, callbackMain){
      var match = [];
      if(self.params.filters.geographies !== undefined) match.push({geography : { $in:self.params.geographyIds }});
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
      var project = ToolsProject[self.toolName];

      if(self.params.filters.mediaType == 'onScreen')
        self.fetchOnScreenData(geographies, match, group, project, callbackMain);
      else
        self.fetchOffScreenData(geographies, match, group, project, callbackMain);
    };

    self.fetchOnScreenData = function(geographies, match, group, project, callbackMain){
      project['resultMallName'] = 1;
      project['cinemaName'] = 1;
      project['theatreName'] = 1;
      project['screenNumber'] = 1;
      project['creativeFormat'] = 1;
      project['urlSlug'] = 1;
      project['mediaOptions.10SecMuteSlide.'+self.params.nextFriday] = 1;
      project['mediaOptions.10SecAudioSlide.'+self.params.nextFriday] = 1;
      project['mediaOptions.30SecVideo.'+self.params.nextFriday] = 1;
      project['mediaOptions.60SecVideo.'+self.params.nextFriday] = 1;

      if(!self.params.recommended)
      {
        Media.aggregate(match, {$project:project}, function(err, medias){
          if(geographies.length) callback(err, self.populateOnScreenData(medias, geographies));
          else
          {
            var geographyIds = [];
            for(i in medias) geographyIds.push(medias[i].geography[0]);
            Geography.find({ _id:{ $in:geographyIds } }).lean().exec(function(err, results){
              var geographies = {};
              for(i in results) geographies[results[i]._id.toString()] = results[i];
              geographies['length'] = results.length;
              callbackMain(err, {allScreens:self.populateOnScreenData(medias, geographies)});
            });
          }
        });
      }
      else
      {
        var finalMedias = [];  
        Media.aggregate(match, {$project:project}, group, function(err, medias){
          if(err) console.log(err);
          for(key in medias)
          {
            medias[key].geoBasedMedias.sort(function(a,b){ return b.seats - a.seats});
            medias[key].geoBasedMedias = medias[key].geoBasedMedias.slice(0,2);                  
            finalMedias = finalMedias.concat(medias[key].geoBasedMedias);
          }
          medias = finalMedias;          
          if(geographies.length) callback(err, self.populateOnScreenData(medias, geographies));
          else
          {
            var geographyIds = [];
            for(i in medias) geographyIds.push(medias[i].geography[0]);
            Geography.find({ _id:{ $in:geographyIds } }).lean().exec(function(err, results){
              var geographies = {};
              for(i in results) geographies[results[i]._id.toString()] = results[i];
              geographies['length'] = results.length;
              callbackMain(err, {recommendedScreens:self.populateOnScreenData(medias, geographies)});
            });
          }
        });
      }
    };

    self.populateOnScreenData = function(medias, geographies){
      var totalPrice10SecMuteSlide = 0;
      var totalPrice10SecAudioSlide = 0;
      var totalPrice30SecVideo = 0;
      var totalPrice60SecVideo = 0;

      var cities = [];
      var cinemas = [];
      var reach = 0;
      var totalSeats = 0;
      if(medias.length > 0)
      {
        for(i in medias)
        {
          totalPrice10SecMuteSlide += medias[i].mediaOptions['10SecMuteSlide'][self.params.nextFriday].showRate;
          totalPrice10SecAudioSlide += medias[i].mediaOptions['10SecAudioSlide'][self.params.nextFriday].showRate;
          totalPrice30SecVideo += medias[i].mediaOptions['30SecVideo'][self.params.nextFriday].showRate;
          totalPrice60SecVideo += medias[i].mediaOptions['60SecVideo'][self.params.nextFriday].showRate;

          totalSeats += medias[i].seats;
          medias[i]['city'] = geographies[medias[i].geography[0]].city;
          medias[i]['state'] = geographies[medias[i].geography[0]].state;
          if(cities.indexOf(medias[i].city) <= -1) 
            cities.push(medias[i].city);
          if(cinemas.indexOf(medias[i].theatreName) <= -1) 
            cinemas.push(medias[i].theatreName);
        }
      }
      var data = {
        count:medias.length, 
        screens:medias, 
        totalPrice10SecMuteSlide:totalPrice10SecMuteSlide,
        totalPrice10SecAudioSlide:totalPrice10SecAudioSlide,
        totalPrice30SecVideo:totalPrice30SecVideo,
        totalPrice60SecVideo:totalPrice60SecVideo, 
        cities:{ count:cities.length, values:cities }, 
        cinemas:{ count:cinemas.length, values:cinemas }, 
        reach:(totalSeats * 4 * 7)
      };

      return data;
    }

    self.fetchOffScreenData = function(geographies, match, group, project, callbackMain){
      project['mediaOptions'] = 1;
      project['dimensions'] = 1;
      Media.aggregate(match, {$project:project}, function(err, medias){
        if(err) console.log(err);
        if(geographies.length) callbackMain(err, self.populateOffScreenData(medias, geographies));
        else
        {
          var geographyIds = [];
          for(i in medias) geographyIds.push(medias[i].geography[0]);
          Geography.find({ _id:{ $in:geographyIds } }).lean().exec(function(err, results){
            var geographies = {};
            for(i in results) geographies[results[i]._id.toString()] = results[i];
            geographies['length'] = results.length;
            callbackMain(err, self.populateOffScreenData(medias, geographies));
          });
        }
      });
    }

    self.populateOffScreenData = function(medias, geographies){
      var totalPrice = 0;
      var cities = [];
      var reach = 0;
      var totalSeats = 0;
      if(medias.length > 0)
      {
        for(i in medias)
        {
          totalPrice += medias[i].mediaOptions['voucherDistribution'].discountedRate;
          totalSeats += medias[i].seats;
          medias[i]['city'] = geographies[medias[i].geography[0]].city;
          medias[i]['state'] = geographies[medias[i].geography[0]].state;
          if(cities.indexOf(medias[i].city) <= -1) 
            cities.push(medias[i].city);
        }
      }
      var data = {
        count:medias.length, 
        screens:medias, 
        totalPrice:totalPrice, 
        cities:{ count:cities.length, values:cities }, 
        reach:(totalSeats * 4 * 30)
      };

      return {offScreen:data};
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
                          {$match: {toolId:self.toolId, "cinemaChain": { $exists: 1}, "cinemaChain" : { "$ne": "Single Screen" }, isActive : 1}},
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
        if(err) return res.status(500).json(err);
        res.status(200).json({upcomingMovies:results});
      }
    );
  };

  this.show = function(req, res){
    //req.query.urlSlug = decodeURI(req.query.urlSlug);
    Media.findOne({urlSlug: req.params.urlSlug , toolId : self.toolId, isActive:1 }).lean().exec(
      function(err, results)
      {
        if(err) return res.status(500).json(err);
        if(!results) return res.status(404).json({error : 'No Such Media Found'});
        Geography.find({ _id:{ $in:results.geography } }).lean().exec(function(err, geos){
          if(geos) results.geography = geos;
          if(results.type == 'onScreen')
          {
            results.name = results.cinemaChain+ ", "+ results.resultMallName;
            mallName = results.resultMallName;
            dateObj = new Date();
            dateObj.setDate(dateObj.getDate() + (12 - dateObj.getDay()) % 7);
            var nextFriday = ('0' + dateObj.getDate()).slice(-2) + '/'
                              + ('0' + (dateObj.getMonth()+1)).slice(-2) + '/'
                              + dateObj.getFullYear();
            
            results.mediaOptions['10SecMuteSlide'] = results.mediaOptions['10SecMuteSlide'][nextFriday];
            results.mediaOptions['10SecAudioSlide'] = results.mediaOptions['10SecAudioSlide'][nextFriday];
            results.mediaOptions['30SecVideo'] = results.mediaOptions['30SecVideo'][nextFriday];
            results.mediaOptions['60SecVideo'] = results.mediaOptions['60SecVideo'][nextFriday];
          }
          else 
          {
            results.name = results.cinemaChain+ ", "+ results.mallName;
            mallName = results.mallName;
          }
          var location = results.resultMallName + ' '+results.geography[0].city;
          if(results.about) 
          {
            description = results.about;
          }
          else 
          {
            //description = 'Get access to 'results.cinemaChain+" at "+mallName+" has a maximum capacity of "+results.seats+" per show. You can find Off Screen Advertising Rate and Advertising Cost for "+results.cinemaChainne+", "+results.mallName+" at The Media Ant";
            description = results.cinemaChain+ ' Advertising in '+location+' is utilized by a variety of brands to reach to their target audience. Get access to the list of '+results.cinemaChain+' Cinema Advertising Screens in '+results.cinemaChain+' at The Media Ant. You can explore '+results.cinemaChain+' Cinema advertising rates and '+results.cinemaChain+' Cinema advertising cost in '+location+' here.';
          }

          keyWords = [results.cinemaChain+ ' Cinema advertising rates in '+location, results.cinemaChain+ ' Cinema in '+location+' ad rates', results.cinemaChain+ ' Cinema in '+location+' media kit', results.cinemaChain+ ' Cinema in '+location+' card rates', results.cinemaChain+ ' Cinema in '+location+' advertising', results.cinemaChain+ ' Cinema in '+location+' advertising details', results.cinemaChain+ ' Cinema in '+location+' pricing details', 'how to advertise in '+results.cinemaChain+ ' Cinema in '+location, results.cinemaChain+ ' Cinema in '+location+' media rates', results.cinemaChain+ ' Cinema in '+location+' advertising manager', results.cinemaChain+ ' Cinema in '+location+' contact details', results.cinemaChain+ ' Cinema in '+location+' advertising contact', results.cinemaChain+ ' Cinema in '+location+' media contact', results.cinemaChain+ ' cinema slide advertising in '+location, location+ results.cinemaChain+ ' theatre ads',  results.cinemaChain+ ' multiplex advertising in '+location, results.cinemaChain+ ' audio slide advertising in '+location, results.cinemaChain+ ' mute slide advertising in '+location];
          var metaTags = {
            title : results.cinemaChain+ ' Advertising in '+location+' >> Rates for '+results.cinemaChain+' Advertisement in '+location,
            image  : results.imageUrl,
            description  : description,
            facebook : self.config.facebook,
            twitter : self.config.twitter,
            keyWords : keyWords
          }
          res.status(200).json({cinema : results, metaTags : metaTags});
        });
      }
    );

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      urlSlug: req.params.urlSlug,
      type: 'media',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  }

};

module.exports.Cinema = Cinema;