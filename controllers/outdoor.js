var Outdoor = function()
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

  this.getOutdoor = function(req, res){
        res.status(200).json("self.params");
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function(callback)
      {
        callback(null, self.applyFilters());
      },
      function(query, callback)
      {
        if(self.params.recommended) return self.radioRecommend(query,callback);
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
        'mediaTypes' : 'mediaType',
        'landmarks' : 'landmark',
        'sizes' : 'size',
        'types' : 'type'
      };
      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'ID' : 1,
        'name' : 1,
        'category' : 1,
        'mediaOptions' : 1,
        'geography' : 1,
        'size' : 1,        
        'logo' : 1
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
            case 'topSearched': query.sortBy = { 'views' : -1 }; break;
            case 'price': query.sortBy = { 'category' : -1}; break;
            case 'size': query.sortBy = {}; break;
          }
          query.sortBy._id = 1;

          Media.aggregate(
            {$match: query.match}, //{$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              var geographyIds = [];
              var mediaOptions = [];
              var firstmediaOptionsKey;
              var minimumQtyUnit1;
              var minimumQtyUnit2;
              var pricingUnit1;
              var pricingUnit2;
              var minimumUnit;
              var minimumBilling; 
              for(i in results) geographyIds.push(results[i].geography);
              Geography.find({_id : {$in: geographyIds}},'city').lean().exec(function(err, geos){
                geographies = {};
                for(i in geos) geographies[geos[i]._id] = geos[i];

                for(i in results) results[i]['city'] = geographies[results[i].geography].city;
                if(self.params.sortBy == 'minimumBilling') results.sort(function(a,b){ return a.minimumBilling < b.minimumBilling });
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
      mediaTypes : self.getMediaType,
      landmarks : self.getLandmark,
      sizes : self.getSize,
      types : self.getTypes
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
      res.status(200).json({filters:results});
    });
  };

    self.getMediaType = function(callback){
      var mediaOptions = [
        {'_id' : 'hoarding', 'name' : 'Hoarding'},
        {'_id' : 'bus shelter', 'name' : 'Bus Shelter'},
        {'_id' : 'pole kiosk', 'name' : 'Pole Kiosk'}
      ];
      callback(null, mediaOptions);
    };

    self.getSize = function(callback){
      var mediaOptions = [
        {'_id' : 'small', 'name' : 'Small'},
        {'_id' : 'large', 'name' : 'Large'},
        {'_id' : 'medium', 'name' : 'Medium'}
      ];
      callback(null, mediaOptions);
    };

    self.getLandmark = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "landmark": { $exists: 1} }},
        {$group : { _id : '$landmark', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getTypes = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "type": { $exists: 1} }},
        {$group : { _id : '$type', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

  this.show = function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, results)
      {
        if(!results) res.status(404).json({error : 'No Such Media Found'});
        Geography.findOne()
        res.status(200).json({radio : results});        
      }
    );
  }

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'urlSlug' : 1,
      'name' : 1,
      'locality' : 1,
      'landmark' : 1,
      'price' : 1,
      'category' : 1,
      'mediaOptions' : 1,
      'geography' : 1,        
      'logo' : 1
    };
    
    Media.find({_id: { $in: ids }}, project,function(err, results){
      res.status(200).json({medias:results});
    });
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




module.exports.Outdoor = Outdoor;