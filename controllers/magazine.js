var Magazine = function()
{
  var async = require('async');
  var underscore = require('underscore');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var months = ['','january','february','march','april','may','june','july','august','september','october','november','december'];
  var days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  
  this.params = {};
  this.toolName = "magazine";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getMagazines = function(req, res){
    self.params = JSON.parse(req.query.params);
    if(self.params.recommended === 'tma') 
    {
      var ProductInfo = [];
      var CS = [];
      var NoCS = [];
      var FinalData = [];
      var mediacategorybuckets = [];
      var noncategorybuckets = [];
      var media = [];
      var GeoMediaCount = 0;
      var NonGeoMediaCount = 0;
      var CountOfMedia = 0
      
      async.series({
        product : function(callback){
          Products.findOne({_id: self.params.productId}, function(err, result){
            ProductInfo.push(result.toObject());
            callback(err, result);
          });
        },
        medias : function(callback){
          var categoryNames = {};

          //All the eliminators from product with Media
          var match = {
            "$match" : {
              $or: [
                {"eliminators.gender" : ProductInfo[0].eliminators.gender},
                {"eliminators.income" : ProductInfo[0].eliminators.income},
                {"eliminators.age" : { $in: ProductInfo[0].eliminators.age }},
                {"eliminators.consumption" : ProductInfo[0].eliminators.consumption }
              ]
            }
          };
          var project = {
            "$project" : {
              "urlSlug" : 1,
              "categoryId" : 1,
              "attributes" : 1,
              "print.mediaOptions.fullPage.1-2" : 1,
              "geography"  : 1,
              "thumbnail" : 1,
              "keywords" : 1,
              "IRS" : 1,
              "createdBy": 1,
              "logo": 1
            }
          };
          Media.aggregate([match, project], function(err, media){callback(err, media);});
        }
      }, 
      function(err, result)
      {
        //Match the keywords
        if(ProductInfo[0].keywords){
        for(var i= 0; i < result.medias.length; i++)
        {
          var check = getMatch(ProductInfo[0].keywords, result.medias[i].keywords);
          if(check.length > 0) CS.push(result.medias[i]);
        }
        }

        if(CS.length > 0)
        {
          //Sort CS based on the readership
          CS = CS.sort(function(a,b){
            return a.attributes.readership.value - b.attributes.readership.value;
          });                

          //Add the last data i.e highest readership to the Finaldata
          FinalData[0] = CS[CS.length - 1];
          CountOfMedia = CountOfMedia + 1;

          //Pop up the last element which is added to the Finaldata
          CS.pop();
        }
        else CS = result.medias; 

        //Create Buckets Based on Category
        for(var i= 0; i < ProductInfo[0].categoryIds.length; i++)
        {
          mediacategorybuckets.push(createbucket(CS, ProductInfo[0].categoryIds[i], i));
        }

        //Find Medias that does not belong to any category with category 1
        var NonCatCS0 = [];
        for (var i = 0; i < CS.length; i++) 
        {
          var match = false; // we haven't found it yet
          if(mediacategorybuckets[0])
          {
            for (var j = 0; j < Object.keys(mediacategorybuckets[0]).length; j++) 
            {
              if (CS[i].categoryId !== mediacategorybuckets[0][j].categoryId) 
                // we have found a[i] in b, so we can stop searching
                match = true;
                //break;
            }
            //add a[i] to newArray only if we didn't find a match.
            if(match) NonCatCS0.push(CS[i]);
          }
        }

        //Find Medias that does not belong to any category with category 2
        var NonCatCS1 = [];
        for (var i = 0; i < NonCatCS0.length; i++) 
        {
          var match = false; // we haven't found it yet
          if(mediacategorybuckets[1])
          {
            for (var j = 0; j < Object.keys(mediacategorybuckets[1]).length; j++) 
            {
              if (NonCatCS0[i].categoryId !== mediacategorybuckets[1][j].categoryId)
                  // we have found a[i] in b, so we can stop searching
                  match = true;
                  //break;
            }
            //add a[i] to newArray only if we didn't find a match.
            if(match) NonCatCS1.push(CS[i]);
          }
        }

        //Find Medias that does not belong to any category with category 3
        var NonCatCS2 = [];
        for (var i = 0; i < NonCatCS1.length; i++) 
        {
          var match = false; // we haven't found it yet
          if(mediacategorybuckets[2])
          {
            for (var j = 0; j < Object.keys(mediacategorybuckets[2]).length; j++) 
            {
              if (NonCatCS1[i].categoryId !== mediacategorybuckets[2][j].categoryId) 
                // we have found a[i] in b, so we can stop searching
                match = true;
                //break;
            }
            //add a[i] to newArray only if we didn't find a match.
            if (match) NonCatCS2.push(CS[i]);
          } 
        }
                
        //Find Medias that does not belong to any category with category 4
        var NonCatCS = [];
        for (var i = 0; i < NonCatCS2.length; i++) 
        {
          var match = false; // we haven't found it yet
          if(mediacategorybuckets[3])
          {
            for (var j = 0; j < Object.keys(mediacategorybuckets[3]).length; j++) 
            {
              if (NonCatCS2[i].categoryId !== mediacategorybuckets[3][j].categoryId) 
                // we have found a[i] in b, so we can stop searching
                match = true;
                //break;
            }                    
            //add a[i] to newArray only if we didn't find a match.
            if (match) NonCatCS.push(CS[i]);
          }
          else NonCatCS.push(NonCatCS2[i]);
        }               

        //Divide  Category 1 Buckets Based on Geography
        var mediaCategoryBuckets1_Geo = [];
        var mediaCategoryBuckets1_nonGeo = [];
        if(mediacategorybuckets[0])
        {
          for(var i= 0; i < Object.keys(mediacategorybuckets[0]).length; i++)
          {
            if(mediacategorybuckets[0][i].geography == self.params.geography)
            {
              mediaCategoryBuckets1_Geo.push(mediacategorybuckets[0][i]);
            }
            else
            {
              mediaCategoryBuckets1_nonGeo.push(mediacategorybuckets[0][i]);
            }
          }
        }

        //Divide  Category 2 Buckets Based on Geography
        var mediaCategoryBuckets2_Geo = [];
        var mediaCategoryBuckets2_nonGeo = [];
        if(mediacategorybuckets[1])
        {
          for(var i= 0; i < Object.keys(mediacategorybuckets[1]).length; i++)
          {
            if(mediacategorybuckets[1][i].geography == self.params.geography)
            {
              mediaCategoryBuckets2_Geo.push(mediacategorybuckets[1][i]);
            }
            else
            {
              mediaCategoryBuckets2_nonGeo.push(mediacategorybuckets[1][i]);
            }
          }
        }

        //Divide  Category 3 Buckets Based on Geography
        var mediaCategoryBuckets3_Geo = [];
        var mediaCategoryBuckets3_nonGeo = [];
        if(mediacategorybuckets[2])
        {
          for(var i= 0; i < Object.keys(mediacategorybuckets[2]).length; i++)
          {
            if(mediacategorybuckets[2][i].geography == self.params.geography){
              mediaCategoryBuckets3_Geo.push(mediacategorybuckets[2][i]);
            }
            else
            {
              mediaCategoryBuckets3_nonGeo.push(mediacategorybuckets[2][i]);
            }
          }
        }

        //Divide  Category 4 Buckets Based on Geography
        var mediaCategoryBuckets4_Geo = [];
        var mediaCategoryBuckets4_nonGeo = [];
        if(mediacategorybuckets[3])
        {
          for(var i= 0; i < Object.keys(mediacategorybuckets[3]).length; i++)
          {
            if(mediacategorybuckets[3][i].geography == self.params.geography)
            {
              mediaCategoryBuckets4_Geo.push(mediacategorybuckets[3][i]);
            }
            else
            {
              mediaCategoryBuckets4_nonGeo.push(mediacategorybuckets[3][i]);
            }
          }
        }

        //Calculte Y value for the mediaCategoryBuckets1_Geo
        var YdataMediaCategoryBuckets1_Geo = [];
        if(mediaCategoryBuckets1_Geo.length > 0) 
        {
          YdataMediaCategoryBuckets1_Geo.push(calculateY(mediaCategoryBuckets1_Geo));
          GeoMediaCount = (GeoMediaCount + YdataMediaCategoryBuckets1_Geo.length);
        }

        //Calculte Y value for the mediaCategoryBuckets2_Geo
        var YdataMediaCategoryBuckets2_Geo = [];
        if(mediaCategoryBuckets2_Geo.length > 0) 
        {
          YdataMediaCategoryBuckets2_Geo.push(calculateY(mediaCategoryBuckets2_Geo));
          GeoMediaCount = (GeoMediaCount + YdataMediaCategoryBuckets2_Geo.length);
        }

        //Calculte Y value for the mediaCategoryBuckets3_Geo
        var YdataMediaCategoryBuckets3_Geo = [];
        if(mediaCategoryBuckets3_Geo.length > 0) 
        {
          YdataMediaCategoryBuckets3_Geo.push(calculateY(mediaCategoryBuckets3_Geo));
          GeoMediaCount = (GeoMediaCount + YdataMediaCategoryBuckets3_Geo.length);
        }

        //Calculte Y value for the mediaCategoryBuckets4_Geo
        var YdataMediaCategoryBuckets4_Geo = [];
        if(mediaCategoryBuckets4_Geo.length > 0) 
        {
          YdataMediaCategoryBuckets4_Geo.push(calculateY(mediaCategoryBuckets4_Geo));
          GeoMediaCount = (GeoMediaCount + YdataMediaCategoryBuckets4_Geo.length);
        }
 
        // Push the medias with to final data
        while (CountOfMedia < 9 && GeoMediaCount > 0) 
        {
          if(YdataMediaCategoryBuckets1_Geo.length > 0)
          {
            FinalData[CountOfMedia] = YdataMediaCategoryBuckets1_Geo[0];
            CountOfMedia = CountOfMedia + 1;
            NonGeoMediaCount = NonGeoMediaCount - 1;
            YdataMediaCategoryBuckets1_Geo.shift();
          }

          if(YdataMediaCategoryBuckets2_Geo.length > 0)
          {
            FinalData[CountOfMedia] = YdataMediaCategoryBuckets2_Geo[0];
            CountOfMedia = CountOfMedia + 1;
            NonGeoMediaCount = NonGeoMediaCount - 1;
            YdataMediaCategoryBuckets2_Geo.shift();
          }

          if(YdataMediaCategoryBuckets3_Geo.length > 0)
          {
            FinalData[CountOfMedia] = YdataMediaCategoryBuckets3_Geo[0];
            CountOfMedia = CountOfMedia + 1;
            NonGeoMediaCount = NonGeoMediaCount - 1;
            YdataMediaCategoryBuckets3_Geo.shift();
          }

          if(YdataMediaCategoryBuckets4_Geo.length > 0)
          {
            FinalData[CountOfMedia] = YdataMediaCategoryBuckets4_Geo[0];
            CountOfMedia = CountOfMedia + 1;
            NonGeoMediaCount = NonGeoMediaCount - 1;
            YdataMediaCategoryBuckets4_Geo.shift();
          }
        }

        if(CountOfMedia == 8)
        {
          //Sort final data base on sort by option
          switch (self.params.sortBy)
          {
            case 'views': 
              FinalData = FinalData.sort(function(a,b){ return b.views - a.views; }); 
              break;      
            case 'price': 
              FinalData = FinalData.sort(function(a,b){                
                            return a.print.mediaOptions.fullPage['1-2'] - b.print.mediaOptions.fullPage['1-2'];
                          });                
              break;
            case 'category': 
              FinalData = FinalData.sort(function(a,b){ return b.categoryName - a.categoryName; });
              break;
            case 'circulation': 
              FinalData = FinalData.sort(function(a,b){                
                            return b.attributes.circulation.value - a.attributes.circulation.value;
                          });
              break;
            }

            var catIds = [];
            for ( var i = 0; i < FinalData.length; i++ ) 
            {
            catIds.push(FinalData[i].categoryId);
            }

            CommonLib.getCategoryName(catIds, function(err, catNames){
              for(var i=0; i<FinalData.length;i++){
                FinalData[i].categoryName = catNames[FinalData[i].categoryId];
              }
              res.status(200).json({count:FinalData.length, magazines:FinalData});
            });
            
        }



          //Calculte Y value for the mediaCategoryBuckets1_nonGeo
          var YdataMediaCategoryBuckets1_nonGeo = [];
          if(mediaCategoryBuckets1_nonGeo.length > 0) 
          {
            YdataMediaCategoryBuckets1_nonGeo = YdataMediaCategoryBuckets1_nonGeo.concat(mediaCategoryBuckets1_nonGeo);
            //YdataMediaCategoryBuckets1_nonGeo.push(calculateY(mediaCategoryBuckets1_nonGeo));
            NonGeoMediaCount = (NonGeoMediaCount + YdataMediaCategoryBuckets1_nonGeo.length);
          }

          //Calculte Y value for the mediaCategoryBuckets2_nonGeo
          var YdataMediaCategoryBuckets2_nonGeo = [];
          if(mediaCategoryBuckets2_nonGeo.length > 0) 
          {
            YdataMediaCategoryBuckets2_nonGeo = YdataMediaCategoryBuckets2_nonGeo.concat(mediaCategoryBuckets2_nonGeo);
            //YdataMediaCategoryBuckets2_nonGeo.push(calculateY(mediaCategoryBuckets2_nonGeo));
            NonGeoMediaCount = (NonGeoMediaCount + YdataMediaCategoryBuckets2_nonGeo.length);
          }

          //Calculte Y value for the mediaCategoryBuckets3_nonGeo
          var YdataMediaCategoryBuckets3_nonGeo = [];
          if(mediaCategoryBuckets3_nonGeo.length > 0) 
          {
            YdataMediaCategoryBuckets3_nonGeo = YdataMediaCategoryBuckets3_nonGeo.concat(mediaCategoryBuckets3_nonGeo);
            //YdataMediaCategoryBuckets3_nonGeo.push(calculateY(mediaCategoryBuckets3_nonGeo));
            NonGeoMediaCount = (NonGeoMediaCount + YdataMediaCategoryBuckets3_nonGeo.length);
          }

          //Calculte Y value for the mediaCategoryBuckets4_nonGeo
          var YdataMediaCategoryBuckets4_nonGeo = [];
          if(mediaCategoryBuckets4_nonGeo.length > 0) 
          {
            YdataMediaCategoryBuckets4_nonGeo.push(calculateY(mediaCategoryBuckets4_nonGeo));
            NonGeoMediaCount = (NonGeoMediaCount + YdataMediaCategoryBuckets4_nonGeo.length);
          }

          while (CountOfMedia < 9 && NonGeoMediaCount > 0) 
          {
            if(YdataMediaCategoryBuckets1_nonGeo.length > 0)
            {
              FinalData[CountOfMedia] = YdataMediaCategoryBuckets1_nonGeo[0];
              CountOfMedia = CountOfMedia + 1;
              NonGeoMediaCount = NonGeoMediaCount - 1;
              YdataMediaCategoryBuckets1_nonGeo.shift();
            }
            if(YdataMediaCategoryBuckets2_nonGeo.length > 0)
            {
              FinalData[CountOfMedia] = YdataMediaCategoryBuckets2_nonGeo[0];
              CountOfMedia = CountOfMedia + 1;
              NonGeoMediaCount = NonGeoMediaCount - 1;
              YdataMediaCategoryBuckets2_nonGeo.shift();
            }
            if(YdataMediaCategoryBuckets3_nonGeo.length > 0)
            {
              FinalData[CountOfMedia] = YdataMediaCategoryBuckets3_nonGeo[0];
              CountOfMedia = CountOfMedia + 1;
              NonGeoMediaCount = NonGeoMediaCount - 1;
              YdataMediaCategoryBuckets3_nonGeo.shift();
            }
            if(YdataMediaCategoryBuckets4_nonGeo.length > 0)
            {
              FinalData[CountOfMedia] = YdataMediaCategoryBuckets4_nonGeo[0];
              CountOfMedia = CountOfMedia + 1;
              NonGeoMediaCount = NonGeoMediaCount - 1;
              YdataMediaCategoryBuckets4_nonGeo.shift();
            }
          }

          if(CountOfMedia == 8)
          {
            //Sort final data base on sort by option
            switch (self.params.sortBy)
            {
              case 'views':          
                FinalData = FinalData.sort(function(a,b){                
                    var x = a.views > b.views ? -1:1;
                    return x;
                }); 
                break;      
              case 'price': 
                FinalData = FinalData.sort(function(a,b){                
                  var x = a.print.mediaOptions.fullPage['1-2'] > b.print.mediaOptions.fullPage['1-2'] ? -1:1;
                  return x;
                });                
                break;      
              case 'category': 
                FinalData = FinalData.sort(function(a,b){                
                  var x = a.categoryName < b.categoryName ? -1:1;
                  return x;
                });
                break;
              case 'circulation': 
                FinalData = FinalData.sort(function(a,b){                
                  var x = a.attributes.circulation.value > b.attributes.circulation.value ? -1:1;
                  return x;
                });
                break;
            }
            
            var catIds = [];
            for ( var i = 0; i < FinalData.length; i++ ) 
            {
            catIds.push(FinalData[i].categoryId);
            }

            CommonLib.getCategoryName(catIds, function(err, catNames){
              for(var i=0; i<FinalData.length;i++){
                FinalData[i].categoryName = catNames[FinalData[i].categoryId];
              }
              res.status(200).json({count:FinalData.length, magazines:FinalData});
            });

            //res.status(200).json({count:FinalData.length, magazine:FinalData});
          }

          //Divide  Non Category Buckets Based on All India and others
          var mediaNonCategoryBuckets_GeoAllIndia = [];
          var mediaNonCategoryBuckets_nonGeoRest = [];
          if(NonCatCS)
          {
            for(var i= 0; i < NonCatCS.length; i++)
            {
              if(NonCatCS[i].geography == "All India")
              {
                mediaNonCategoryBuckets_GeoAllIndia.push(NonCatCS[i]);
              }
              else
              {
                mediaNonCategoryBuckets_nonGeoRest.push(NonCatCS[i]);
              }
            }
          }

          var IRSCode = [];
          var NonIRSCode = [];
          if(mediaNonCategoryBuckets_GeoAllIndia.length > 0)
          {
            for(var i= 0; i < mediaNonCategoryBuckets_GeoAllIndia.length; i++)
            {
              if(mediaNonCategoryBuckets_GeoAllIndia[i].IRSCode == 'Yes')
              {
                IRSCode.push(mediaNonCategoryBuckets_GeoAllIndia[i]);
              }
              else
              {
                NonIRSCode.push(mediaNonCategoryBuckets_GeoAllIndia[i]);
              }
            }
          }
          
          //Sort CS based on the readership
          IRSCode = IRSCode.sort(function(a,b){
            var x = a.attributes.readership.value < b.attributes.readership.value? -1:1;
            return x;
          });

          //Add Sorted Magazines with IRS Code based on Readership to Finaldata
          if(IRSCode.length > 0)
          {
            for(var i= 0; i < IRSCode.length; i++)
            {
              if(CountOfMedia < 9) 
              {
                FinalData[CountOfMedia] = IRSCode[0];
                CountOfMedia = CountOfMedia + 1;
              }
              else
              {
                res.status(200).json(FinalData);
              }
            }
          }

          //Sort final data base on sort by option
          switch (self.params.sortBy)
          {
            case 'views': 
              FinalData = FinalData.sort(function(a,b){                
                var x = a.views > b.views ? -1:1;
                return x;
              }); 
              break;
            case 'price': 
              FinalData = FinalData.sort(function(a,b){                
                var x = a.print.mediaOptions.fullPage['1-2'] > b.print.mediaOptions.fullPage['1-2'] ? -1:1;
                return x;
              });                
              break;
            case 'category': 
              FinalData = FinalData.sort(function(a,b){                
                var x = a.categoryName < b.categoryName ? -1:1;
                return x;
              });
              break;   
            case 'circulation': 
              FinalData = FinalData.sort(function(a,b){                
                var x = a.attributes.circulation.value > b.attributes.circulation.value ? -1:1;
                return x;
              });
              break;
          }
          
          var catIds = [];
            for ( var i = 0; i < FinalData.length; i++ ) 
            {
            catIds.push(FinalData[i].categoryId);
            }

            CommonLib.getCategoryName(catIds, function(err, catNames){
              for(var i=0; i<FinalData.length;i++){
                FinalData[i].categoryName = catNames[FinalData[i].categoryId];
              }
              res.status(200).json({count:FinalData.length, magazines:FinalData});
            });


          //res.status(200).json({count:FinalData.length, magazines:FinalData});
        }
      );
    } 
    else 
    {
      async.waterfall([
        function(callback)
        {
          callback(null, self.applyFilters());
        },
        function(query, callback)
        {
          if(self.params.recommended =="top3")
          {
            self.top3(query, callback);
          } 
          else 
          {
            self.sortFilteredMedia(query, callback);
          }
        }
      ],
      function (err, result) 
      {

        for(key in result.magazines)
          result.magazines[key].attributes = CommonLib.removeHiddenAttributes(result.magazines[key].attributes);
        res.status(200).json(result);
      });
    }
  };

    /*//................................ test ......................//*/

    function getMatch(a, b) 
    {
      var matches = [];
      for ( var i = 0; i < a.length; i++ ) 
      {
        for ( var e = 0; e < b.length; e++ ) 
        {
          if ( a[i] === b[e] ) matches.push( a[i] );
        }
      }
      return matches;
    }

    function createbucket(CS, ProductMagazineCategory) 
    {
      var MCB = {};
      var i = 0;
      for (var newcsKey in CS) 
      {
        var newcs = CS[newcsKey];
        var tmp = {};
        if(newcs.categoryId == ProductMagazineCategory)
        {
          tmp = newcs;
          if(Object.keys(tmp).length > 0) MCB[i] = tmp;
          i++;
        }
      }
      return MCB;
    }

    function calculateY(mediaCategoryBuckets_nonGeo) 
    {
      //Sort mediaCategoryBuckets1_nonGeo based on the readership
      maxReadership = mediaCategoryBuckets_nonGeo.sort(function(a,b){
        var x = a.attributes.readership.value < b.attributes.readership.value? -1:1;
        return x;
      });

      //Add the last data i.e highest readership to the Finaldata
      maxReadership = maxReadership[maxReadership.length - 1];
      maxReadership = maxReadership.attributes.readership.value;

      //Sort mediaCategoryBuckets1_nonGeo based on the noOfPages
      maxNoOfPages = mediaCategoryBuckets_nonGeo.sort(function(a,b){
        var x = a.attributes.noOfPages.value < b.attributes.noOfPages.value? -1:1;
        return x;
      });

      //Add the last data i.e highest readership to the Finaldata
      maxNoOfPages = maxNoOfPages[maxNoOfPages.length - 1];
      maxNoOfPages = maxNoOfPages.attributes.noOfPages.value;

      //Sort mediaCategoryBuckets1_nonGeo based on the minFullPage 1-2
      minFullPage = mediaCategoryBuckets_nonGeo.sort(function(a,b){
        var x = a.print.mediaOptions.fullPage['1-2'] < b.print.mediaOptions.fullPage['1-2']? -1:1;
        return x;
      });

      //Add the last data i.e highest readership to the Finaldata
      minFullPage = minFullPage[minFullPage.length - 1];
      minFullPage = minFullPage.print.mediaOptions.fullPage['1-2'];

      for(var i= 0; i < mediaCategoryBuckets_nonGeo.length; i++)
      {
        var tmp = [];
        tmp['_id'] = mediaCategoryBuckets_nonGeo[i]._id;
        tmp['categoryId'] = mediaCategoryBuckets_nonGeo[i].categoryId;
        tmp['urlSlug'] = mediaCategoryBuckets_nonGeo[i].urlSlug;
        tmp['thumbnail'] = mediaCategoryBuckets_nonGeo[i].thumbnail;
        tmp['IRS'] = mediaCategoryBuckets_nonGeo[i].IRS;
        tmp['logo'] = mediaCategoryBuckets_nonGeo[i].logo;

        yValue = (0.6 * ((mediaCategoryBuckets_nonGeo[i].attributes.noOfPages.value * 10)/maxNoOfPages)) + (0.3 * ((mediaCategoryBuckets_nonGeo[i].attributes.readership.value * 10)/maxReadership)) + (0.1 * ((mediaCategoryBuckets_nonGeo[i].print.mediaOptions.fullPage['1-2'] * 10)/minFullPage));
        tmp['yValue'] = yValue;

        media = tmp;
      }

      //Sort mediaCategoryBuckets1_nonGeo based on the noOfPages
      media = media.sort(function(a,b){
        var x = a.yValue < b.yValue? -1:1;
        return x;
      });

      return media;
    }

    //................................ test ......................//

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
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
        'print.mediaOptions.fullPage.1-2' : 1,
        'toolId' : 1,
        'createdBy' : 1,
        'views':1,
        'logo' : 1
      };

      Object.keys(filters).map(function(value){
        if(self.params.filters[value].length)
          query.match[filters[value]] = {'$in': self.params.filters[value]};
      });

      self.params.filters.mediaOptions.forEach(function(value, key){
        query.match['mediaOptions.'+value] = { $exists : 1};
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
        magazines : function(callbackInner)
        {
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
			case 'price': query.sortBy = { 'mediaOptions.print.fullPage.1-2' : -1}; break;
			case 'category': query.sortBy = { 'categoryId' : -1}; break;
            case 'circulation': query.sortBy = { 'attributes.circulation.value' : -1}; break;
          }
          query.sortBy._id = 1;
          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              var catIds = [];
              for ( var i = 0; i < results.length; i++ ) 
              {
                catIds.push(results[i].categoryId);
              }
              CommonLib.getCategoryName(catIds, function(err, catNames){
                for(var i=0; i<results.length;i++)
                  results[i].categoryName = catNames[results[i].categoryId];
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
      categories: self.getCategories,
      geography : self.getGeographies,
      languages : self.getLanguages,
      targetGroups : self.getTargetGroups,
      frequencies : self.getFrequencies,
      mediaOptions: self.getMediaOptions,
      products : self.getProducts
    },
    function(err, results) 
    {
      if(err) res.status(500).json({err:err});
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

    self.getGeographies = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, geography: { $exists: 1}, isActive : 1}},
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

    self.getLanguages = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "attributes.language.value": { $exists: 1}, isActive : 1}},
        {$group : { _id : '$attributes.language.value', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getTargetGroups = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, targetGroup: { $exists: 1}, isActive : 1}},
        {$unwind: '$targetGroup'},
        {$group : { _id : '$targetGroup', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getFrequencies = function(callback){
      Media.aggregate(
        {$match: {toolId:self.toolId, "attributes.frequency": { $exists: 1}, isActive : 1}},
        {$group : { _id : '$attributes.frequency.value', count : {$sum : 1}}},
        function(error, results)
        {
          callback(error, results);
        }
      );
    };

    self.getMediaOptions = function(callback){
      //Hardcoding the values for now, as the frequency of changes is very low
      var mediaOptions = [
        {'_id' : 'print', 'name' : 'Print'},
        {'_id' : 'eMail', 'name' : 'EMail'},
        {'_id' : 'website', 'name' : 'Website'}
      ];
      callback(null, mediaOptions);
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
          console.log(category.name);
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
              //console.log(magazines);
              if(magazines.length>query.offset) {
                for (var i = query.offset; i<(query.offset + query.limit); i++) {
                  if(magazines[i] != undefined) {
                    magazine.push(magazines[i]);
                  }
                }
                //console.log("data from the loop")
              }
              else{
                callback(null, {magazines: magazines,count:magazines.length});
                //console.log("data outside the loop");
              }
              callback(null, {magazines:magazine,count:magazines.length});


            });
          });
        }
      );
    };

  this.getBestRates = function(req, res){
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
        media = media.toObject();
        for(key in medias[media._id].mediaOptions)
        {
          medias[media._id][key] = {};
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
          dates[key][eachDate] = dates[key][eachDate].trim();
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
              console.log(cDate,cMonth,cYear,parseInt(dates[key][eachDate]),currMonth,currYear);
              if(cMonth == dateObj.getMonth() && cYear == dateObj.getFullYear() && cDate <= dateObj.getDate()){}
              else pubDates.push(dateObj);
              break;
            case days.indexOf(dates[key][eachDate].toLowerCase()) > -1:
              var dateObj = new Date();
              if(dateObj.getFullYear != currYear) dateObj.setDate(1);
              while(dateObj.getDay() !== 1) dateObj.setDate(dateObj.getDate() + 1);
              while(dateObj.getMonth() === currMonth) 
              {
                pubDates.push(new Date(dateObj.getTime()));
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
              else pubDates.push(dateObj);
          }
          if(currMonth == 12) {currMonth = 1; currYear++;}
          else currMonth++;
        }
      }
      if(pubDates.length < 10) pubDates = self.formDates(pubDates, dates, currMonth, currYear);
      return pubDates;
    }
};




module.exports.Mag = Magazine;