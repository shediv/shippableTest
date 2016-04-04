var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  var CustomerQuery = require('../models/customerQuery').CustomerQuery;
  var Media = require('../models/media').Media;
  var nodeMailer = require('nodemailer');
  var Contact = require('../models/contact').Contact;
  //var BestRatesEmail = require('../models/bestRatesEmail').BestRatesEmail;
  var CampaignRatesEmail = require('../models/campaignRatesEmail').CampaignRatesEmail;
  var SaveCampaigns = require('../models/saveCampaigns').SaveCampaigns;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  var Lsquare = require('../models/lsquare').Lsquare;
  var HirePlanner = require('../models/hirePlanner').HirePlanner;
  var Cafe = require('../models/cafe').Cafe;
  var SaveCampaigns = require('../models/saveCampaigns').SaveCampaigns;
  var SearchIgnore = require('../config/searchignore.js');
  var Category = require('../models/category').Category;
  var SubCategory = require('../models/subCategory').SubCategory;
  var Geography = require('../models/geography').Geography;
  var jwt = require('jsonwebtoken');
  var underscore = require('underscore');
  var xlReader = require('node-xlsx');
  var excelbuilder = require('msexcel-builder');
  var User = require('../models/user').User;
  var ToolsProject = require('../config/toolsProject.js');

  var self = this;
  this.config = require('../config/config.js');
  this.transporter = nodeMailer.createTransport({
    service: self.config.smtpService,
    host: self.config.smtpHost,
    port: self.config.smtpPort,
    auth: self.config.smtpAuth
  });

  var path = require('path');
  var EmailTemplate = require('email-templates').EmailTemplate;
  var templatesDir = path.resolve(__dirname, '../..', 'public/templates/emailTemplates');

  this.isToolExists = function(req, res){
    var toolName = req.query.toolName;
    toolName = toolName.toLowerCase();
    if(toolName == '' || toolName == null) return res.status(404).json("Tool Name not given");
    if(toolName == '12thcross') return res.status(200).json({ tool:toolName });
    Tools.findOne({ name:toolName }, function(err, result){
      if(err) return res.status(500).json(err);
      if(!result) 
      {
        Media.findOne( {urlSlug:toolName} ).lean().exec(function(err, media){
          if(!media)
          {
            toolName = toolName.replace(/-/g, ' ');
            toolName = toolName.replace(/_/g, ' ');
            toolName = toolName.replace(/\(/g, ' ');
            toolName = toolName.replace(/\)/g, ' ');
            toolName = toolName.split(' ');
            var queries = [];
            for(i in toolName)
            {
              if( SearchIgnore.indexOf(toolName[i]) > -1 ) continue;
              var qRegExp = new RegExp('\\b'+toolName[i], "i");
              queries.push(qRegExp);
            }
            Media.find({ searchKeyWords:{ $all:queries }, isActive:1 }).lean().exec(function(err, media){
              if(!media.length) return res.status(404).json({status:"NO MEDIAS FOUND"});
              if(media.length == 1)
              {
                Tools.findOne({ _id:media[0].toolId }).lean().exec(function(err, tool){
                  return res.status(200).json({ tool:tool.name, urlSlug:media[0].urlSlug });  
                });
              }
              else
              {
                Tools.findOne({ _id:media[0].toolId }).lean().exec(function(err, tool){
                  return res.status(200).json({ tool:tool.name });
                });
              }
            });
          }
          else
          Tools.findOne({ _id:media.toolId }).lean().exec(function(err, tool){
            return res.status(200).json({ tool:tool.name, urlSlug:media.urlSlug });  
          });
        });
      }
      else
      return res.status(200).json({ tool:result.name });
    });
  }

  this.addCustomerQuery = function(req, res){
    req.body.userAgent = req.headers['user-agent'];
    req.body.remoteAddress = req.headers['x-forwarded-for'] || req.ip;
    var customerQuery = CustomerQuery(req.body);
    customerQuery.save(function(err,result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(500).json("NOT OK");
      res.status(200).json('OK');
    });
  }

  this.contactMail = function(req, res){
    var toolName;
    var urlGiven = '';
    if(req.body.toolName) { toolName =  CommonLib.capitalizeFirstLetter(req.body.toolName);  }
    if(req.body.urlSlug) { urlGiven =  req.body.urlSlug }    
    var mailOptions = {};
    mailOptions.email = req.body.email;
    mailOptions.to = "help@themediaant.com";
    mailOptions.message = req.body.message;
    mailOptions.toolName = toolName || 'General';
    mailOptions.urlGiven = urlGiven;
    mailOptions.createdAt = new Date()
    mailOptions.appHost = self.config.appHost;
    var newContact = Contact(mailOptions);

    // save the Contact mail
    newContact.save(function(err){
      if(err) return res.status(500).json(err);
      var emailTemplate = new EmailTemplate(path.join(templatesDir, 'assistanceContact'));
      emailTemplate.render(mailOptions, function(err, results){
        if(err) return console.error(err)
        self.transporter.sendMail({
          from: req.body.email, // sender address
          to: mailOptions.to, // list of receivers
          cc: req.body.email,
          subject: urlGiven+'|'+mailOptions.toolName+' - Request for Assistance ',
          html: results.html
        }, function(err, responseStatus){
          if(err) return console.error(err);
           return res.status(200).json("sucess");
        })
      });

    });
  }

  this.getSiteMap = function(req, res){
    async.parallel({
      twelthCross : function(callbackInner)
      {
        TwelthCross.aggregate(
          {$match: {"urlSlug": { $exists: 1}, isActive: 1 }},
          //{$skip : 0}, {$limit: 10},
          { $project: { url: { $concat: [ "http://", self.config.appHost,"/12thcross/", "$urlSlug" ] } } },
          { $group : { _id : "$url"}},
          function(error, twelthCross)
          {
            for(i in twelthCross) twelthCross[i] = twelthCross[i]._id;
            callbackInner(error, twelthCross);
          }
        );
      },
      media : function(callbackInner)
      {
        Media.aggregate(
          {$match: {"urlSlug": { $exists: 1}, "toolId": { $exists: 1}, isActive: 1 }},
          //{$skip : 0}, {$limit: 5},
          { $group : { _id : "$toolId", count : {$sum : 1}, medias: {$push: "$urlSlug"}}},
          function(error, results)
          {
            var toolIds = [];
            var toolName = [];
            for(i in results) toolIds.push(results[i]._id);
              Tools.find({_id : {$in: toolIds}},'name').lean().exec(function(err, tool){
              for(i in tool) toolName[tool[i]._id] = tool[i];
              for(i in results)
              {
                if(toolName[results[i]._id].name !== undefined) results[i]['_id'] = toolName[results[i]._id].name;
              }
              callbackInner(error, results);
            });
          }
        );
      },
      cafe : function(callbackInner)
      {
        Cafe.aggregate(
          {$match: {"url": { $exists: 1} }},
          //{$skip : 0}, {$limit: 10},
          { $project: { url: { $concat: [ "http://", self.config.appHost,"/chakra/redirect?url=", "$url" ] } } },
          { $group : { _id : "$url"}},
          function(error, cafe)
          {
            for(i in cafe) cafe[i] = cafe[i]._id;
            callbackInner(error, cafe);
          }
        );
      },
      lsquare : function(callbackInner)
      {
        Lsquare.aggregate(
          {$match: {"urlSlug": { $exists: 1} }},
          //{$skip : 0}, {$limit: 10},
          { $project: { url: { $concat: [ "http://", self.config.appHost,"/chakra/lsquare/", "$urlSlug" ] } } },
          { $group : { _id : "$url"}},
          function(error, lsquare)
          {
            for(i in lsquare) lsquare[i] = lsquare[i]._id;
            callbackInner(error, lsquare);
          }
        );
      },
      tool : function(callbackInner)
      {
        Tools.aggregate(
          {$match: {"name": { $exists: 1} }},
          //{$skip : 0}, {$limit: 10},
          { $project: { url: { $concat: [ "http://", self.config.appHost,"/", "$name" ] } } },
          { $group : { _id : "$url"}},
          function(error, tool)
          {
            for(i in tool) tool[i] = tool[i]._id;
            callbackInner(error, tool);
          }
        );
      }
    },
    function(err, results)
    {
      var data = [];
      var toolUrl = [];
      if(err) return res.status(500).json(err);
      for(i in results.media)
      {
        for(j in results.media[i].medias)
          data.push('http://'+self.config.appHost+'/'+results.media[i]._id+'/'+results.media[i].medias[j]);
      }
      //toolUrl = ['http://www.themediaant.com/magazine', 'http://www.themediaant.com/cinema', 'http://www.themediaant.com/newspaper', 'http://www.themediaant.com/radio', 'http://www.themediaant.com/television', 'http://www.themediaant.com/outdoor', 'http://www.themediaant.com/airport', 'http://www.themediaant.com/digital', 'http://www.themediaant.com/nontraditional'];
      data = data.concat(results.twelthCross);
      data = data.concat(results.cafe);
      data = data.concat(results.lsquare);
      data = data.concat(results.tool);
      res.status(200).json({url:data, count:data.length});
    });
  };

  this.getSiteMapCategory = function(req, res){
    async.parallel({
      magazine : function(callbackInner)
      {
        Tools.findOne({ name:'magazine' }).lean().exec(function(err, tool){
          self.siteMapToolCategory(tool, callbackInner);
        });
      },
      newspaper : function(callbackInner)
      {
        Tools.findOne({ name:'newspaper' }).lean().exec(function(err, tool){
          self.siteMapNewspaperCategory(tool, callbackInner);
        });
      },
      television : function(callbackInner)
      {
        Tools.findOne({ name:'television' }).lean().exec(function(err, tool){
          self.siteMapTelevisionCategory(tool, callbackInner);
        });
      },
      radio : function(callbackInner)
      {
        Tools.findOne({ name:'radio' }).lean().exec(function(err, tool){
          self.siteMapRadioCategory(tool, callbackInner);
        });
      },
      cinema : function(callbackInner)
      {
        Tools.findOne({ name:'cinema' }).lean().exec(function(err, tool){
          self.siteMapCinemaCategory(tool, callbackInner);
        });
      },
      digital : function(callbackInner)
      {
        Tools.findOne({ name:'digital' }).lean().exec(function(err, tool){
          self.siteMapDigitalCategory(tool, callbackInner);
        });
      },
      airport : function(callbackInner)
      {
        Tools.findOne({ name:'airport' }).lean().exec(function(err, tool){
          self.siteAirportCommonCategory(tool, callbackInner);
        });
      },
      outdoor : function(callbackInner)
      {
        Tools.findOne({ name:'outdoor' }).lean().exec(function(err, tool){
          self.siteMapOutdoorCategory(tool, callbackInner);
        });
      },
      nontraditional : function(callbackInner)
      {
        Tools.findOne({ name:'nontraditional' }).lean().exec(function(err, tool){
          self.siteMapNontraditionalCategory(tool, callbackInner);
        });
      }
    },
    function(err, results)
    {
      return res.status(200).json({url:[].concat(results.magazine, results.television, results.newspaper, results.radio, results.cinema, results.digital, results.airport, results.outdoor, results.nontraditional)});      
      //return res.status(200).json({url:[].concat(results.nontraditional)});      
    });
  };

    self.siteMapToolCategory = function(tool, callbackInner){
      Media.distinct('categoryId', { toolId:tool._id, isActive:1 }, function(err, results){
        Category.distinct('name', { _id:{ $in:results } }, function(err, cats){
          for(i in cats) 
            cats[i] = 'http://'+self.config.appHost+'/'+tool.name+'/category/'+encodeURIComponent(cats[i]);
          callbackInner(err, cats);
        });
      });
    };

    self.siteMapTelevisionCategory = function(tool, callbackInner){
      Media.distinct('categoryId', { toolId:tool._id, isActive:1 }, function(err, results){        
        Category.distinct('name', { _id:{ $in:results } }, function(err, cats){          
          for(i in cats) 
            cats[i] = 'http://'+self.config.appHost+'/'+tool.name+'/category/'+encodeURIComponent(cats[i]);
          callbackInner(err, cats);
        });
      });
    };

    self.siteMapNewspaperCategory = function(tool, callbackInner){
      async.parallel({
        category : function(callback)
        {          
          Media.distinct('categoryId', { toolId:tool._id, isActive:1 }, function(err, results){
            Category.distinct('name', { _id:{ $in:results } }, function(err, cats){
              for(i in cats) 
                cats[i] = 'http://'+self.config.appHost+'/'+tool.name+'/category/'+encodeURIComponent(cats[i]);              
              callback(err, cats);
            });
          });
        },
        city : function(callback)
        {
          Media.distinct('attributes.areaCovered.value', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'/city/'+encodeURIComponent(results[i]);
            callback(err, results);
          });
        },
        language : function(callback)
        {
          Media.distinct('attributes.language.value', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'/language/'+encodeURIComponent(results[i]);
            callback(err, results);
          });
        },
        publications : function(callback)
        {          
          Media.distinct('name', { toolId:tool._id, isActive:1 }, function(err, results){
            console.log(results.length);
            var publications = [];
            for(i in results) publications[i] = 'http://'+self.config.appHost+'/'+tool.name+'/publication/'+encodeURIComponent(results[i]);              
            callback(err, publications);
          });
        }
      },function(err, results){
        callbackInner(err, [].concat(results.category, results.city, results.language, results.publications));
      });
    };

    self.siteMapRadioCategory = function(tool, callbackInner){
      async.parallel({
        station : function(callback)
        {
          Media.distinct('station', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'/station/'+encodeURIComponent(results[i]);
            callback(err, results);
          });
        },
        city : function(callback)
        {
          Media.distinct('attributes.city.value', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'/city/'+encodeURIComponent(results[i]);
            callback(err, results);
          });
        }
      },function(err, results){
        callbackInner(err, [].concat(results.station, results.city));
      });
    };

    self.siteMapCinemaCategory = function(tool, callbackInner){
      async.parallel({
        cinemaChain : function(callback)
        {
          Media.distinct('attributes.cinemaChain.value', { toolId:tool._id, isActive:1, 'attributes.cinemaChain.value':{ $ne:'Single Screen' } }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'/cinemaChain/'+encodeURIComponent(results[i]);
            callback(err, results);
          });
        },
        city : function(callback)
        {
          Media.distinct('geography', { toolId:tool._id, isActive:1 }, function(err, results){
            Geography.distinct('city', { _id:{ $in:results } }, function(err, cities){
              for(i in cities)
                cities[i] = 'http://'+self.config.appHost+'/'+tool.name+'/city/'+encodeURIComponent(cities[i]);
              callback(err, cities);
            });
          });
        },
        cityPlusCinemaChain : function(callback)
        {
          var cinemaLinks = [];
          Media.distinct('attributes.cinemaChain.value', { toolId:tool._id, isActive:1, 'attributes.cinemaChain.value':{ $ne:'Single Screen' } }, function(err, chains){
            async.each(chains, function(chain, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name+'/cinemaChain/'+encodeURIComponent(chain);
              Media.distinct('geography', { toolId:tool._id, isActive:1, 'attributes.cinemaChain.value':chain }, function(err, geos){
                Geography.distinct('city', { _id:{ $in:geos } },function(err, cities){
                  for(i in cities) cinemaLinks.push(base + '/city/' + encodeURIComponent(cities[i]));
                  callbackEach(null);
                });
              });
            }, function(err){
              callback(err, cinemaLinks);
            });
          });
        }
      },function(err, results){
        callbackInner(err, [].concat(results.cinemaChain, results.city, results.cityPlusCinemaChain));
        //callbackInner(err, [].concat(results.city));
      });
    };

    self.siteMapDigitalCategory = function(tool, callbackInner){
      Media.distinct('medium', { toolId:tool._id, isActive:1, 'medium':{ $ne:'SMS' } }, function(err, mediums){                        
          for(i in mediums) 
            mediums[i] = 'http://'+self.config.appHost+'/'+tool.name+'/category/'+encodeURIComponent(mediums[i]);
            callbackInner(err, mediums);
      });
    };

    self.siteAirportCommonCategory = function(tool, callbackInner){
      Media.distinct('category', { toolId:tool._id, isActive:1 }, function(err, categories){                        
          for(i in categories) 
            categories[i] = 'http://'+self.config.appHost+'/'+tool.name+'/category/'+encodeURIComponent(categories[i]);
            callbackInner(err, categories);
      });
    };

    self.siteMapOutdoorCategory = function(tool, callbackInner){
      async.parallel({
        city : function(callback)
        {
          var outdoorLinks = [];
          Media.distinct('mediaType', { toolId:tool._id, isActive:1 }, function(err, mediaTypes){
            async.each(mediaTypes, function(mediaType, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name+'/medium/'+encodeURIComponent(mediaType);
              Media.distinct('geography', { toolId:tool._id, isActive:1, 'mediaType':mediaType }, function(err, geos){
                Geography.distinct('city', { _id:{ $in:geos } },function(err, cities){
                  for(i in cities) outdoorLinks.push(base + '/city/' + encodeURIComponent(cities[i]));
                  callbackEach(null);
                });
              });
            }, function(err){
              callback(err, outdoorLinks);
            });
          });
        },
        cityPlusArea : function(callback)
        {
          var outdoorCityAreaLinks = [];
          Media.distinct('mediaType', { toolId:tool._id, isActive:1 }, function(err, mediaTypes){
            async.each(mediaTypes, function(mediaType, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name+'/medium/'+encodeURIComponent(mediaType);
              Media.distinct('geography', { toolId:tool._id, isActive:1, 'mediaType':mediaType }, function(err, geos){
                Geography.find({ _id:{ $in:geos } }).lean().exec(function(err, cities){                                    
                  for(i in cities) outdoorCityAreaLinks.push(base + '/city/' + encodeURIComponent(cities[i].city) + '/area/' +encodeURIComponent(cities[i].locality));
                  callbackEach(null);
                });
              });
            }, function(err){
              callback(err, outdoorCityAreaLinks);
            });
          });
        }
      },function(err, results){
        callbackInner(err, [].concat(results.city, results.cityPlusArea));        
      });
    };

    self.siteMapNontraditionalCategory = function(tool, callbackInner){
      async.parallel({
        category : function(callback)
        {
          var nonTradLinks = [];
          Media.distinct('categoryId', { toolId:tool._id, isActive:1, "categoryId" : { "$ne": "55f873bb8ead0e79178b456b" }}, function(err, categoryIds){
            async.each(categoryIds, function(categoryId, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name;
              Category.distinct('name', { _id:categoryId, isActive:1}, function(err, categoryName){
                  nonTradLinks.push(base + '/category/' + encodeURIComponent(categoryName));
                  callbackEach(null);
              });
            }, function(err){
              callback(err, nonTradLinks);
            });
          });
        },
        categoryPlusSubCat : function(callback)
        {
          var nonTradSubLinks = [];
          Media.distinct('categoryId', { toolId:tool._id, isActive:1, "categoryId" : { "$ne": "55f873bb8ead0e79178b456b" }}, function(err, categoryIds){
            async.each(categoryIds, function(categoryId, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name;
              Category.distinct('name', { _id:categoryId, isActive:1}, function(err, categoryName){
                  base = base + '/category/' + encodeURIComponent(categoryName);
                  SubCategory.distinct('name', { categoryId:categoryId, isActive:1, "_id" : { "$ne": "55f89db98ead0e85178b89d5" }}, function(err, subCategoryNames){
                    for(i in subCategoryNames) nonTradSubLinks.push(base + '/subCategory/' + encodeURIComponent(subCategoryNames[i]));
                  })
                  callbackEach(null);
              });
            }, function(err){
              callback(err, nonTradSubLinks);
            });
          });
        }
      },function(err, results){        
        callbackInner(err, [].concat(results.category, results.categoryPlusSubCat));                
      });
    };  

  this.getCommonMetaTags = function(req, res){
    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      type: 'common'
    };
    //CommonLib.uniqueVisits(visitor);

    Tools.distinct('name', {}, function(err, tools){
      return res.status(200).json({
        title : 'The Media Ant',
        description : 'TheMediaAnt.com is a market place for media. The Media Ant has information for more than 2,00,000 advertising touch points across various offline and online media verticals. Media owners list the details of their media on the site for advertisers to discover and execute. This is a free service both to the media owners and the advertisers. ',
        image : 'image',
        twitter : self.config.twitter,
        facebook : self.config.facebook,
        keyWords : [],
        tools : tools
      });
    });
  };

  this.getMetaTags = function(req, res){    
    
    var filters = {
      category : "category",      
      city : "city",
      language : "language",
      channelGenre : "channelGenre",
      station : "station",
      cinemaChain : "cinemaChain",
      area : "area",
      publication : "publication",
      medium : "medium",
      subCategory : "subCategory"
    }

    Object.keys(filters).map(function(value){
        if(req.query.name1){
          if(req.query.name1 == filters[value])  req.query[filters[value]] = req.query.value1;
        }
        if(req.query.name1 && req.query.name2){
         if(req.query.name1 == filters[value])  req.query[filters[value]] = req.query.value1;
         if(req.query.name2 == filters[value])  req.query[filters[value]] = req.query.value2; 
        }
        if(req.query.name1 && req.query.name2 && req.query.name3){
         if(req.query.name1 == filters[value])  req.query[filters[value]] = req.query.value1;
         if(req.query.name2 == filters[value])  req.query[filters[value]] = req.query.value2;
         if(req.query.name3 == filters[value])  req.query[filters[value]] = req.query.value3; 
        }         
    });

    //console.log(req.query);    

    var toolName = req.query.mediaType ? req.query.mediaType : '';

    var params = '';

    if(toolName == 'lsquare')
    {
      self.getMetaTagsLsquare(res); 
    }
    else
    if(toolName == '12thcross')
    {
      self.getMetaTagsTwelthCross(res);
    }
    else
    if(toolName == 'cafe')
    {
      self.getMetaTagscafe(req, res);
    }
    else
    if(toolName == '')
    {
      return res.status(200).json("Tool Not Found");
    }
    else
    { 
      Tools.findOne({ name:toolName },{ categoryPage : 1 }).lean().exec(function(err, result){                  
        var toolData = result;
        if(!result) {console.log('Meta error: ',toolName); return res.status(404).json({status:"NOT OK"});}
        async.series([
          function(callback)
          {                        
            self.fetchParamsForCategory(result, toolName, req, res, callback);
          }
          ], function(err, params){
          params = params[0];
          return res.status(200).json(params);  

        });
      });
    }      
  }

    self.formatCategoryData = function(finalData, mediaData){
        var data = {
          description : finalData.results.description,
          title : finalData.results.title,
        }
        finalData.data = data;
        for(i in mediaData){
          //console.log(mediaData[i].attributes);
          mediaData[i].attributes = CommonLib.removeHiddenAttributes(mediaData[i].attributes);
        }
        finalData.medias = mediaData;
        delete finalData.results;
        return finalData;
    }

    self.newspaperCartFormat = function(mediaData){
        for(i in mediaData){
          mediaData[i].attributes.editionName = { value : mediaData[i].editionName };
          mediaData[i].attributes.pricingUnit = { value : 'per '+mediaData[i].mediaOptions.regularOptions.anyPage.pricingUnit1 };                  
          mediaData[i].cardRate = mediaData[i].mediaOptions.regularOptions.anyPage['<800SqCms'].cardRate;                                  
          delete mediaData[i].attributes.printDay;
          delete mediaData[i].attributes.frequency;
        }
        return mediaData;
    }

    self.radioCartFormat = function(mediaData){
        for(i in mediaData){          
          mediaData[i].attributes.pricingUnit = { value : 'per 10 sec' };                  
          mediaData[i].cardRate = mediaData[i].mediaOptions.regularOptions.allDayPlan.cardRate;                                            
        }
        return mediaData;
    }

    self.cinemaCartFormat = function(mediaData, type){
        for(i in mediaData){          
          mediaData[i].attributes.mediaOption = { value : '10sec mute slide' };
          mediaData[i].attributes.pricingUnit = { value : 'per Week' };
          if(type == "offScreen"){
            firstmediaOptionsKey = Object.keys(mediaData[i]['mediaOptions']['regularOptions'])[0];
            mediaData[i].cardRate = mediaData[i].mediaOptions['regularOptions'][firstmediaOptionsKey].cardRate;
          }else{
            if(mediaData[i].mediaOptions.nonBlockBusterRate) mediaData[i].cardRate = mediaData[i].mediaOptions.nonBlockBusterRate['10SecMuteSlide'].cardRate;            
          }                  
          //mediaData[i].cardRate = mediaData[i].mediaOptions.regularOptions.allDayPlan.cardRate;
          delete mediaData[i].attributes.cinemaChain;
          delete mediaData[i].mediaOptions;                                            
        }
        return mediaData;
    }

    self.digitalCartFormat = function(mediaData){
        for(i in mediaData){
          mediaData[i].attributes = CommonLib.removeHiddenAttributes(mediaData[i].attributes);          
          mediaData[i].attributes.reach = mediaData[i].attributes.reach1;
          mediaData[i].attributes.medium = { value : mediaData[i].medium };                          
          //mediaData[i].cardRate = mediaData[i].mediaOptions.regularOptions.allDayPlan.cardRate;
          if(mediaData[i]['mediaOptions']){
            mediaData[i].attributes['mediaOption'] = { value : mediaData[i]['mediaOptions']['regularOptions'].mediaOption1.showName+" & more" };
            if(mediaData[i]['mediaOptions']['regularOptions'].mediaOption1.minimumQtyUnit1 && mediaData[i]['mediaOptions']['regularOptions'].mediaOption1.pricingUnit1){
              mediaData[i].attributes['pricingUnit'] ={ value : mediaData[i]['mediaOptions']['regularOptions'].mediaOption1.minimumQtyUnit1+" "+mediaData[i]['mediaOptions']['regularOptions'].mediaOption1.pricingUnit1 };
            }

            //To calculte card rate
            firstmediaOptionsKey = Object.keys(mediaData[i]['mediaOptions']['regularOptions'])[0];                  
            if(mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit1; }
            if(mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit2; }
            if(mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit1; }
            if(mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit2; }                                      
            
            if(minimumQtyUnit2)
            {
              minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
              minimumBilling = (mediaData[i].mediaOptions.regularOptions.mediaOption1.cardRate * minimumQtyUnit1 * minimumQtyUnit2);
            }
            else
            {
              minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;
              minimumBilling =  mediaData[i].mediaOptions.regularOptions.mediaOption1.cardRate *  minimumQtyUnit1;
            }
            mediaData[i]['cardRate'] = minimumBilling;                  
          }                                              
          delete mediaData[i].attributes.reach1;
          if(mediaData[i].attributes.reach1) delete mediaData[i].attributes.reach1;
          if(mediaData[i].attributes.reach2) delete mediaData[i].attributes.reach2;
          if(mediaData[i].attributes.unit2) delete mediaData[i].attributes.unit2;
          if(mediaData[i].attributes.language) delete mediaData[i].attributes.language;
          delete mediaData[i].attributes.unit1;
        }
        return mediaData;
    }

    self.airportCartFormat = function(mediaData){
        for(i in mediaData){          
          firstmediaOptionsKey = Object.keys(mediaData[i]['mediaOptions']['regularOptions'])[0];
          if(mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit1; }
          if(mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit2; }
          if(mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit1; }
          if(mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit2; }                                      
          
          if(minimumQtyUnit2)
          {
            minimumUnit = CommonLib.addCommas(minimumQtyUnit1) + ' ' + pricingUnit1 + ' / ' + CommonLib.addCommas(minimumQtyUnit2) + ' ' + pricingUnit2;
            minimumBilling = (mediaData[i].mediaOptions.regularOptions.mediaOption1.cardRate * minimumQtyUnit1 * minimumQtyUnit2);
          }
          else
          {
            minimumUnit =  CommonLib.addCommas(minimumQtyUnit1) + ' ' +  pricingUnit1;
            minimumBilling =  mediaData[i].mediaOptions.regularOptions.mediaOption1.cardRate *  minimumQtyUnit1;
          }

          var firstMediaOption = {
            value : mediaData[i].mediaOptions.regularOptions.mediaOption1.showName+" & more"  
          }

          var minimumUnit = {
            value : minimumUnit
          }

          mediaData[i].attributes ={};
          mediaData[i].attributes.firstMediaOption = firstMediaOption;
          mediaData[i].attributes.minimumUnit = minimumUnit;
          mediaData[i].cardRate= minimumBilling;                                            
        }
        return mediaData;
    }

    self.outdoorCartFormat = function(mediaData){
        for(i in mediaData){          
          mediaData[i].cardRate = mediaData[i].mediaOptions['regularOptions']['mediaOption1'].cardRate;
          mediaData[i].attributes = {};
          mediaData[i].attributes.size = { value : mediaData[i].mediaOptions['regularOptions']['mediaOption1'].area.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " sq ft (" +mediaData[i].size+")" };
          mediaData[i].attributes.uniqueId = { value : mediaData[i].uniqueId };                                            
        }
        return mediaData;
    }

    self.nontraditionalCartFormat = function(mediaData){
      for(i in mediaData)
      {                  
        if(mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit1; }
        if(mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = mediaData[i].mediaOptions.regularOptions.mediaOption1.minimumQtyUnit2; }
        if(mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit1; }
        if(mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = mediaData[i].mediaOptions.regularOptions.mediaOption1.pricingUnit2; }                                      
        
        if(minimumQtyUnit2)
        {
          minimumUnit = CommonLib.addCommas(minimumQtyUnit1) + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
          minimumBilling = (mediaData[i].mediaOptions.regularOptions.mediaOption1.cardRate * minimumQtyUnit1 * minimumQtyUnit2);
        }
        else
        {
          minimumUnit =  CommonLib.addCommas(minimumQtyUnit1) + ' ' +  pricingUnit1;
          minimumBilling =  mediaData[i].mediaOptions.regularOptions.mediaOption1.cardRate *  minimumQtyUnit1;
        }

        var attributes = {
          "mediaOption" : {
            "value" :  mediaData[i].mediaOptions.regularOptions.mediaOption1.showName +" & more"  
          },
          "pricingUnit" : {
            "value" :  minimumUnit
          }                    
        }
        
        mediaData[i].cardRate = minimumBilling;
        mediaData[i].attributes = attributes;
        mediaData[i].toolName = self.toolName;
        delete mediaData[i].mediaOptions;
        delete mediaData[i].geography;
        //sor attributes in a order of display
        var filters = ['mediaOption', 'pricingUnit'];
        var newObj = {};    
        Object.keys(filters).map(function(key){          
          newObj[filters[key]] = mediaData[i].attributes[filters[key]];
        });
        mediaData[i].attributes = newObj;
      }
      return mediaData;
    }

    self.getMetaTagsLsquare = function(res){
      Lsquare.distinct('urlSlug',{},function(err, medias){
        if(err) return res.status(500).json(err);
        return res.status(200).json({
          title : 'Lsquare » Q & A forum',
          description : 'LSquare is a Q&A forum where questions related to media|marketing are asked and answered  by its community of users.',
          image : 'image',
          twitter : self.config.twitter,
          facebook : self.config.facebook,
          medias : medias,
          keyWords : []
        });
      });
    };

    self.getMetaTagsTwelthCross = function(res){
      TwelthCross.distinct('urlSlug',{},function(err, medias){
        if(err) return res.status(500).json(err);
        return res.status(200).json({
          title : '12th Cross » Services Marketplace',
          description : '12th cross is a marketplace where service providers can list their areas of expertise to be discovered by advertisers who can avail these services to assist in creating and placing an ad.',
          image : 'image',
          twitter : self.config.twitter,
          facebook : self.config.facebook,
          medias : medias,
          keyWords : []
        });
      });
    };

    self.getMetaTagscafe = function(req, res){
      if(!req.query.url)
      {
        return res.status(200).json({
          title : 'Cafe » Read | Share',
          description : 'Read and Share Marketing Articles with India\'s largest content sharing platform for Marketing.',
          image : 'image',
          twitter : self.config.twitter,
          facebook : self.config.facebook,
          medias : [],
          keyWords : []
        });
      }
      else
      {
        Cafe.findOne({ url:req.query.url }).lean().exec(function(err, cafe){
          if(!cafe)
          {
            return res.status(200).json({
              title : 'Cafe » Read | Share',
              description : 'Read and Share Marketing Articles with India\'s largest content sharing platform for Marketing.',
              image : 'image',
              twitter : self.config.twitter,
              facebook : self.config.facebook,
              medias : [],
              keyWords : []
            });
          }
          else
          {
            return res.status(200).json({
              title : cafe.title + ' Cafe » Read | Share',
              description : cafe.title + ' Read and Share Marketing Articles with India\'s largest content sharing platform for Marketing.',
              image : 'image',
              twitter : self.config.twitter,
              facebook : self.config.facebook,
              medias : [],
              keyWords : [cafe.title]
            });
          }
        });
      }
    };

    self.fetchParamsForCategory = function(result, toolName, req, res, callback){
      if(!req.query.category && !req.query.city && !req.query.station && !req.query['language'] && !req.query['cinemaChain'] && !req.query.area && !req.query['channelGenre'] && !req.query.publication && !req.query.medium && !req.query.subCategory)
        return callback(null, {});
      var projection = ToolsProject[toolName];
      switch(toolName)
      {
        case 'magazine':
          if(req.query.category)
          {            
            Category.findOne({ name:req.query.category }).lean().exec(function(err, categoryData){ 
              if(err) return res.status(404).json({status:"Category Not FOUND"});              
              Media.find({toolId : result._id, categoryId : categoryData._id}, projection).lean().exec(function(errMedia, mediaData){
                if(err) return res.status(404).json({status:"Category Not FOUND in Media"});
                var matchReplace = {
                "categoryName": req.query.category,
                "count" : mediaData.length
                };

                for(i in mediaData){
                  mediaData[i].attributes.categoryName = { value : req.query.category };
                  mediaData[i].cardRate = CommonLib.addCommas(mediaData[i].mediaOptions.regularOptions.fullPage.cardRate);
                  delete mediaData[i].attributes.language;
                  delete mediaData[i].attributes.coverPrice;
                  delete mediaData[i].attributes.readership;                  
                }

                //console.log(mediaData.length);
                result.metaTags = result.categoryPage.metaTags;
                result.description = result.categoryPage.description;
                result.title = result.categoryPage.title;
                delete result.categoryPage;
                delete result._id;                

                var finalData = CommonLib.seoGeneration(matchReplace, result);
                finalData = self.formatCategoryData(finalData, mediaData);                              
                callback(errMedia, finalData);
              })
            })
          }
          else callback(null, {});
          break;
        case 'newspaper':        
          if(req.query.category)
          {
            //console.log(req.query.category);
            var matchReplace = {
                "category": req.query.category
            };

            Category.findOne({ name:req.query.category }).lean().exec(function(err, categoryData){ 
              if(err) return res.status(404).json({status:"Category Not FOUND"});              
              Media.find({toolId : result._id, categoryId : categoryData._id}, projection).lean().exec(function(errMedia, mediaData){
                if(err) return res.status(404).json({status:"Category Not FOUND in Media"});
                //console.log(mediaData.length);
                mediaData = self.newspaperCartFormat(mediaData);                
                result.metaTags = result.categoryPage.category.metaTags;
                result.description = result.categoryPage.category.description;
                result.title = result.categoryPage.category.title;
                delete result.categoryPage;
                delete result._id;                                
                var finalData = CommonLib.seoGeneration(matchReplace, result);
                finalData = self.formatCategoryData(finalData, mediaData);
                callback(errMedia, finalData);
              })
            })
          }
          else if(req.query.publication)
          {            
            var matchReplace = {
                "publication": req.query.publication
            };            
                          
            Media.find({toolId : result._id, 'name' : req.query.publication}).lean().exec(function(errMedia, mediaData){
              if(errMedia) return res.status(404).json({status:"City Not FOUND in Media"});
              //console.log(mediaData.length);
              mediaData = self.newspaperCartFormat(mediaData);
              result.metaTags = result.categoryPage.publication.metaTags;
              result.description = result.categoryPage.publication.description;
              result.title = result.categoryPage.publication.title;
              delete result.categoryPage;
              delete result._id;              

              var finalData = CommonLib.seoGeneration(matchReplace, result);
              finalData = self.formatCategoryData(finalData, mediaData);
              callback(errMedia, finalData);
            })
          }
          else if(req.query.city)
          {
            var matchReplace = {
                "city": req.query.city
            };
                          
            Media.find({toolId : result._id, 'attributes.areaCovered.value' : req.query.city}).lean().exec(function(errMedia, mediaData){
              if(errMedia) return res.status(404).json({status:"City Not FOUND in Media"});
              //console.log(mediaData.length);
              mediaData = self.newspaperCartFormat(mediaData);
              result.metaTags = result.categoryPage.city.metaTags;
              result.description = result.categoryPage.city.description;
              result.title = result.categoryPage.city.title;
              delete result.categoryPage;
              delete result._id;              

              var finalData = CommonLib.seoGeneration(matchReplace, result);
              finalData = self.formatCategoryData(finalData, mediaData);
              callback(errMedia, finalData);
            })
          }
          else if(req.query['language'])
          {            
            var matchReplace = {
                "language": req.query['language']
            };
              
            Media.find({toolId : result._id, 'attributes.language.value' : req.query['language']}).lean().exec(function(errMedia, mediaData){
              if(errMedia) return res.status(404).json({status:"Language Not FOUND in Media"});
              //console.log(mediaData.length);
              mediaData = self.newspaperCartFormat(mediaData);
              result.metaTags = result.categoryPage.language.metaTags;
              result.description = result.categoryPage.language.description;
              result.title = result.categoryPage.language.title;
              delete result.categoryPage;
              delete result._id;              

              var finalData = CommonLib.seoGeneration(matchReplace, result);
              finalData = self.formatCategoryData(finalData, mediaData);
              callback(errMedia, finalData);
            })
          }          
          else callback(null, {});
          break;
        case 'television':
          if(req.query.category)
          {
            var matchReplace = {
                "channelGenre": req.query.category
            };

            Category.findOne({ name:req.query.category }).lean().exec(function(err, categoryData){ 
              if(err) return res.status(404).json({status:"Category Not FOUND"});              
              Media.find({toolId : result._id, categoryId : {$in: categoryData._id}}, projection).lean().exec(function(errMedia, mediaData){
                if(err) return res.status(404).json({status:"Category Not FOUND in Media"});
                for(i in mediaData){
                  mediaData[i].attributes.genres = { value : req.query.category },
                  mediaData[i].attributes.pricingUnit = { value : 'per 10 sec' }                
                  if(mediaData[i].mediaOptions !== undefined)
                  {
                    var price = [];                    
                    for(j in mediaData[i].mediaOptions['regularOptions']) price.push(mediaData[i].mediaOptions['regularOptions'][j].cardRate)
                    mediaData[i].cardRate = underscore.min(price)
                  }
                }
                result.metaTags = result.categoryPage.metaTags;
                result.description = result.categoryPage.description;
                result.title = result.categoryPage.title;
                delete result.categoryPage;
                delete result._id;                

                var finalData = CommonLib.seoGeneration(matchReplace, result);
                finalData = self.formatCategoryData(finalData, mediaData);
                callback(errMedia, finalData);
              })
            })
          }
          else callback(null, {});
          break;  
        case 'radio':
          if(req.query.station)
          {
            Media.find({toolId : result._id, 'station' : req.query.station}, projection).lean().exec(function(errMedia, mediaData){
                  if(errMedia || mediaData.length < 1) return res.status(404).json({status:"City Not FOUND in Media"});                  
                  var matchReplace = {
                      "station": req.query.station,
                      "radioFrequency": mediaData[0].attributes.radioFrequency.value                    
                  };
                  
                  mediaData = self.radioCartFormat(mediaData);
                  result.metaTags = result.categoryPage.station.metaTags;
                  result.description = result.categoryPage.station.description;
                  result.title = result.categoryPage.station.title;
                  delete result.categoryPage;
                  delete result._id;                                
                  var finalData = CommonLib.seoGeneration(matchReplace, result);
                  finalData = self.formatCategoryData(finalData, mediaData);
                  callback(errMedia, finalData);
            });
          }
          else if(req.query.city)
          {
            var matchReplace = {
                "city": req.query.city
            };

            Media.find({toolId : result._id, 'attributes.city.value' : req.query.city}, projection).lean().exec(function(errMedia, mediaData){
              if(errMedia) return res.status(404).json({status:"City Not FOUND in Media"});
              mediaData = self.radioCartFormat(mediaData);
              result.metaTags = result.categoryPage.city.metaTags;
              result.description = result.categoryPage.city.description;
              result.title = result.categoryPage.city.title;
              delete result.categoryPage;
              delete result._id;                            
              var finalData = CommonLib.seoGeneration(matchReplace, result);
              finalData = self.formatCategoryData(finalData, mediaData);
              callback(errMedia, finalData);
            });
          }         
          else callback(null, {});
          break;
        case 'cinema':
          if(req.query.cinemaChain && req.query.city)
          {
            var matchReplace = {
                      "cinemaChain": req.query.cinemaChain.replace("Cinemas", ""),
                      "city": req.query.city                                         
            };

            var geoIds = [];

            Geography.find({city : req.query.city}).lean().exec(function(err, geoData){
              if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
              for(i in geoData) geoIds.push(geoData[i]._id.toString());                            
              Media.find({toolId : result._id, geography : {$in: geoIds}, 'attributes.cinemaChain.value' : req.query.cinemaChain, "attributes.cinemaChain.value" : { "$ne": "Single Screen" }}, projection).lean().exec(function(errMedia, mediaData){
                if(errMedia) return res.status(404).json({status:"Cinema Chain Not FOUND in Media"});
                mediaData = self.cinemaCartFormat(mediaData, req.query.type);
                result.metaTags = result.categoryPage.cinemaChainCity_.metaTags;
                result.description = result.categoryPage.cinemaChainCity_.description;
                result.title = result.categoryPage.cinemaChainCity_.title;
                delete result.categoryPage;
                delete result._id;              

                var finalData = CommonLib.seoGeneration(matchReplace, result);
                finalData = self.formatCategoryData(finalData, mediaData);
                callback(errMedia, finalData);
              });
            })
          }
          else if(req.query.cinemaChain)
          {
            var matchReplace = {
                      "cinemaChain": req.query.cinemaChain.replace("Cinemas", "")                                         
            };

            Media.find({toolId : result._id, 'attributes.cinemaChain.value' : req.query.cinemaChain, "attributes.cinemaChain.value" : { "$ne": "Single Screen" }}, projection).lean().exec(function(errMedia, mediaData){
                  if(errMedia) console.log({status:"cinemaChain Not FOUND in Media"});
                  mediaData = self.cinemaCartFormat(mediaData, req.query.type);
                  if(req.query.type == "offScreen"){                  
                    result.metaTags = result.categoryPage.cinemaChain.offScreen.metaTags;
                    result.description = result.categoryPage.cinemaChain.offScreen.description;
                    result.title = result.categoryPage.cinemaChain.offScreen.title;
                  }else{
                    result.metaTags = result.categoryPage.cinemaChain.onScreen.metaTags;
                    result.description = result.categoryPage.cinemaChain.onScreen.description;
                    result.title = result.categoryPage.cinemaChain.onScreen.title;
                  }  
                  delete result.categoryPage;
                  delete result._id;              

                  var finalData = CommonLib.seoGeneration(matchReplace, result);
                  finalData = self.formatCategoryData(finalData, mediaData);
                  callback(errMedia, finalData);
            });
          }
          else if(req.query.city)
          {
            var matchReplace = {
                "city": req.query.city
            };

            var geoIds = [];            

            Geography.find({city : req.query.city}).lean().exec(function(err, geoData){                                          
              if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
              for(i in geoData) geoIds.push(geoData[i]._id.toString());              
              Media.find({toolId : result._id, geography : {$in: geoIds}}).lean().exec(function(errMedia, mediaData){
                if(errMedia) return res.status(404).json({status:"City Not FOUND in Media"});
                mediaData = self.cinemaCartFormat(mediaData, req.query.type);
                result.metaTags = result.categoryPage.city.metaTags;
                result.description = result.categoryPage.city.description;
                result.title = result.categoryPage.city.title;
                delete result.categoryPage;
                delete result._id;                              
                var finalData = CommonLib.seoGeneration(matchReplace, result);
                finalData = self.formatCategoryData(finalData, mediaData);                
                callback(errMedia, finalData);
              });              
            })  
          }         
          else callback(null, {});
          break;
        case 'digital':
          if(req.query.category)
          {
            if(req.query.category == 'App'){
              Media.find({toolId : result._id, medium : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //digitalCartFormat
                mediaData = self.digitalCartFormat(mediaData);
                result.metaTags = result.categoryPage.App.metaTags;
                result.twitter = result.categoryPage.App.twitter;              
                result.facebook = result.categoryPage.App.facebook;                
                delete result._id;
                var data = {
                  description : result.categoryPage.App.description,
                  title : result.categoryPage.App.title
                }
                result.medias = mediaData;
                result.data = data;
                delete result.categoryPage;                              
                callback(null, result); 
              })
            }else if(req.query.category == 'Database'){
              Media.find({toolId : result._id, medium : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //digitalCartFormat
                mediaData = self.digitalCartFormat(mediaData);
                result.metaTags = result.categoryPage.Database.metaTags;
                result.twitter = result.categoryPage.Database.twitter;              
                result.facebook = result.categoryPage.Database.facebook;                            
                delete result._id;
                  var data = {
                    description : result.categoryPage.Database.description,
                    title : result.categoryPage.Database.title
                  }
                  result.medias = mediaData;
                  result.data = data;
                delete result.categoryPage;
                callback(null, result);
              })
            }else if(req.query.category == 'Mobile'){
              Media.find({toolId : result._id, medium : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //digitalCartFormat
                mediaData = self.digitalCartFormat(mediaData);
                result.metaTags = result.categoryPage.Mobile.metaTags;
                result.twitter = result.categoryPage.Mobile.twitter;              
                result.facebook = result.categoryPage.Mobile.facebook;              
                delete result._id;
                  var data = {
                    description : result.categoryPage.Mobile.description,
                    title : result.categoryPage.Mobile.title
                  }
                  result.medias = mediaData;
                  result.data = data;
                delete result.categoryPage;
                callback(null, result);
              })
            }else if(req.query.category == 'Website'){
              Media.find({toolId : result._id, medium : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //digitalCartFormat
                mediaData = self.digitalCartFormat(mediaData);
                result.metaTags = result.categoryPage.Website.metaTags;
                result.twitter = result.categoryPage.Website.twitter;              
                result.facebook = result.categoryPage.Website.facebook;              
                delete result._id;
                  var data = {
                    description : result.categoryPage.Website.description,
                    title : result.categoryPage.Website.title
                  }
                  result.medias = mediaData;
                  result.data = data;
                delete result.categoryPage;
                callback(null, result);
              })
            }            
          }
          else callback(null, {});
          break;  
        case 'airport':
          if(req.query.category)
          {            
            if(req.query.category == 'Airport'){
              Media.find({toolId : result._id, category : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //Airport CartFormat
                mediaData = self.airportCartFormat(mediaData);
                result.metaTags = result.categoryPage.Airport.metaTags;                
                result.twitter = result.categoryPage.Airport.twitter;              
                result.facebook = result.categoryPage.Airport.facebook;                
                delete result._id;
                var data = {
                  description : result.categoryPage.Airport.description,
                  title : result.categoryPage.Airport.title
                }
                result.medias = mediaData;
                result.data = data;
                delete result.categoryPage;
                callback(null, result);
              })
            }else if(req.query.category == 'Airline'){
              Media.find({toolId : result._id, category : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //Airport CartFormat
                mediaData = self.airportCartFormat(mediaData);
                result.metaTags = result.categoryPage.Airline.metaTags;
                result.twitter = result.categoryPage.Airline.twitter;              
                result.facebook = result.categoryPage.Airline.facebook;              
                delete result._id;
                var data = {
                    description : result.categoryPage.Airline.description,
                    title : result.categoryPage.Airline.title
                  }
                  result.medias = mediaData;
                  result.data = data;
                delete result.categoryPage;
                callback(null, result);
              })
            }else if(req.query.category == 'Airport Lounge'){
              Media.find({toolId : result._id, category : req.query.category}, projection).lean().exec(function(errMedia, mediaData){
                //Airport CartFormat
                mediaData = self.airportCartFormat(mediaData);
                result.metaTags = result.categoryPage.Airport_Lounge.metaTags;
                result.twitter = result.categoryPage.Airport_Lounge.twitter;              
                result.facebook = result.categoryPage.Airport_Lounge.facebook;              
                delete result._id;
                var data = {
                      description : result.categoryPage.Airport_Lounge.description,
                      title : result.categoryPage.Airport_Lounge.title
                    }
                    result.medias = mediaData;
                    result.data = data;
                delete result.categoryPage;
                callback(null, result);
              })
            }            
          }
          else callback(null, {});
          break;    
        case 'outdoor':
          if(req.query.medium)
          {
            //If Hoarding is selected
            if(req.query.medium == 'Hoarding'){
              if(req.query.city && req.query.area){
                var matchReplace = {
                  "city": req.query.city,
                  "area": req.query.area
                };
                var geoIds = [];
                Geography.find({city : req.query.city, locality : req.query.area}).lean().exec(function(errGeo, geoData){
                  if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
                  for(i in geoData) geoIds.push(geoData[i]._id.toString());
                  Media.find({toolId : result._id, geography : {$in: geoIds}}, projection).lean().exec(function(errMedia, mediaData){
                    if(errMedia) return res.status(404).json({status:"Category Not FOUND in Media"});
                    //Airport CartFormat
                    mediaData = self.outdoorCartFormat(mediaData);
                    result.metaTags = result.categoryPage.Hoarding.areaCity.metaTags;
                    result.description = result.categoryPage.Hoarding.areaCity.description;
                    result.title = result.categoryPage.Hoarding.areaCity.title;
                    delete result.categoryPage;
                    delete result._id;
                    
                    var finalData = CommonLib.seoGeneration(matchReplace, result);
                    finalData = self.formatCategoryData(finalData, mediaData);
                    callback(errMedia, finalData);
                  })
                })
              }else if(req.query.city){
                var matchReplace = {
                  "city": req.query.city                  
                };

                var geoIds = [];
                Geography.find({city : req.query.city}).lean().exec(function(errGeo, geoData){                  
                  if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
                  for(i in geoData) geoIds.push(geoData[i]._id.toString());
                  Media.find({toolId : result._id, 'geography' : {$in: geoIds}}, projection).lean().exec(function(errMedia, mediaData){
                    if(errMedia) return res.status(404).json({status:"Category Not FOUND in Media"});
                    //Airport CartFormat
                    mediaData = self.outdoorCartFormat(mediaData);
                    result.metaTags = result.categoryPage.Hoarding.City.metaTags;
                    result.description = result.categoryPage.Hoarding.City.description;
                    result.title = result.categoryPage.Hoarding.City.title;
                    delete result.categoryPage;
                    delete result._id;                    
                    var finalData = CommonLib.seoGeneration(matchReplace, result);
                    finalData = self.formatCategoryData(finalData, mediaData);
                    callback(errMedia, finalData);
                  })
                })
              }
            }
            else if(req.query.medium == 'Bus Shelter'){
              if(req.query.city && req.query.area){
                var matchReplace = {
                  "city": req.query.city,
                  "area": req.query.area
                };
                var geoIds = [];
                Geography.find({city : req.query.city, locality : req.query.area}).lean().exec(function(errGeo, geoData){
                  if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
                  for(i in geoData) geoIds.push(geoData[i]._id.toString());
                  Media.find({toolId : result._id, geography : {$in : geoIds}}, projection).lean().exec(function(errMedia, mediaData){
                    if(errMedia) return res.status(404).json({status:"Category Not FOUND in Media"});
                    //Airport CartFormat
                    mediaData = self.outdoorCartFormat(mediaData);
                    result.metaTags = result.categoryPage.busShelter.areaCity.metaTags;
                    result.description = result.categoryPage.busShelter.areaCity.description;
                    result.title = result.categoryPage.busShelter.areaCity.title;
                    delete result.categoryPage;
                    delete result._id;
                    
                    var finalData = CommonLib.seoGeneration(matchReplace, result);
                    finalData = self.formatCategoryData(finalData, mediaData);
                    callback(errMedia, finalData);
                  })
                })
              }else if(req.query.city){
                var matchReplace = {
                  "city": req.query.city                  
                };

                var geoIds = [];
                Geography.find({city : req.query.city}).lean().exec(function(errGeo, geoData){
                  if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
                  for(i in geoData) geoIds.push(geoData[i]._id.toString());
                  Media.find({toolId : result._id, geography : {$in : geoIds}}, projection).lean().exec(function(errMedia, mediaData){
                    if(errMedia) return res.status(404).json({status:"Category Not FOUND in Media"});
                    //Airport CartFormat
                    mediaData = self.outdoorCartFormat(mediaData);
                    result.metaTags = result.categoryPage.busShelter.City.metaTags;
                    result.description = result.categoryPage.busShelter.City.description;
                    result.title = result.categoryPage.busShelter.City.title;
                    delete result.categoryPage;
                    delete result._id;
                    
                    var finalData = CommonLib.seoGeneration(matchReplace, result);
                    finalData = self.formatCategoryData(finalData, mediaData);
                    callback(errMedia, finalData);
                  })
                })
              }
            }
            else if(req.query.medium == 'Pole Kiosk'){
              if(req.query.city && req.query.area){
                var matchReplace = {
                  "city": req.query.city,
                  "area": req.query.area
                };
                var geoIds = [];
                Geography.find({city : req.query.city, locality : req.query.area}).lean().exec(function(errGeo, geoData){
                  if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
                  for(i in geoData) geoIds.push(geoData[i]._id.toString());
                  Media.find({toolId : result._id, geography : {$in : geoIds}}, projection).lean().exec(function(errMedia, mediaData){
                    if(errMedia) return res.status(404).json({status:"Category Not FOUND in Media"});
                    //Airport CartFormat
                    mediaData = self.outdoorCartFormat(mediaData);
                    result.metaTags = result.categoryPage.poleKiosk.areaCity.metaTags;
                    result.description = result.categoryPage.poleKiosk.areaCity.description;
                    result.title = result.categoryPage.poleKiosk.areaCity.title;
                    delete result.categoryPage;
                    delete result._id;
                    
                    var finalData = CommonLib.seoGeneration(matchReplace, result);
                    finalData = self.formatCategoryData(finalData, mediaData);
                    callback(errMedia, finalData);
                  })
                })
              }else if(req.query.city){
                var matchReplace = {
                  "city": req.query.city                  
                };
                var geoIds = [];
                Geography.find({city : req.query.city}).lean().exec(function(errGeo, geoData){
                  if(geoData.length == 0) return res.status(404).json({status:"City Not FOUND"});
                  for(i in geoData) geoIds.push(geoData[i]._id.toString());
                  Media.find({toolId : result._id, geography : {$in : geoIds}}, projection).lean().exec(function(errMedia, mediaData){
                    if(errMedia) return res.status(404).json({status:"Category Not FOUND in Media"});
                    //Airport CartFormat
                    mediaData = self.outdoorCartFormat(mediaData);
                    result.metaTags = result.categoryPage.poleKiosk.City.metaTags;
                    result.description = result.categoryPage.poleKiosk.City.description;
                    result.title = result.categoryPage.poleKiosk.City.title;
                    delete result.categoryPage;
                    delete result._id;
                    
                    var finalData = CommonLib.seoGeneration(matchReplace, result);
                    finalData = self.formatCategoryData(finalData, mediaData);
                    callback(errMedia, finalData);
                  })
                })
              }
            }
          }
          else callback(null, {});
          break;  
        case 'nontraditional':
          if(req.query.subCategory && req.query.category)
          {            
            var matchReplace = {
                "categoryName": req.query.subCategory
            };

            Category.findOne({ name:req.query.category }).lean().exec(function(errCat, categoryData){ 
              if(errCat) return res.status(404).json({status:"Category Not FOUND"});
              SubCategory.findOne({ name:req.query.subCategory }).lean().exec(function(errSubCat, subCategoryData){
                if(errSubCat) return res.status(404).json({status:"Sub Category Not FOUND"});
                Media.find({toolId : result._id, categoryId : categoryData._id.toString(), subCategoryId : subCategoryData._id.toString()}, projection).lean().exec(function(errMedia, mediaData){                  
                  if(errMedia || mediaData.length < 1) return res.status(404).json({status:"Category Not FOUND in Media"});                  
                  result.metaTags = result.categoryPage.metaTags;
                  result.description = result.categoryPage.description;
                  result.title = result.categoryPage.title;
                  delete result.categoryPage;
                  delete result._id;                

                  mediaData = self.nontraditionalCartFormat(mediaData);
                  var finalData = CommonLib.seoGeneration(matchReplace, result);
                  finalData = self.formatCategoryData(finalData, mediaData);
                  finalData.count = mediaData.length;                              
                  callback(errMedia, finalData);
                })
              })  
            })
          }else if(req.query.category)
          {
            var matchReplace = {
                "categoryName": req.query.category
            };

            Category.findOne({ name:req.query.category }).lean().exec(function(errCat, categoryData){ 
              if(errCat) return res.status(404).json({status:"Category Not FOUND"});                              
                Media.find({toolId : result._id, categoryId : categoryData._id.toString()}, projection).lean().exec(function(errMedia, mediaData){                  
                  if(errMedia || mediaData.length < 1) return res.status(404).json({status:"Category Not FOUND in Media"});                  
                  result.metaTags = result.categoryPage.metaTags;
                  result.description = result.categoryPage.description;
                  result.title = result.categoryPage.title;
                  delete result.categoryPage;
                  delete result._id;                

                  mediaData = self.nontraditionalCartFormat(mediaData);
                  var finalData = CommonLib.seoGeneration(matchReplace, result);
                  finalData = self.formatCategoryData(finalData, mediaData);
                  finalData.count = mediaData.length;                              
                  callback(errMedia, finalData);
                })                
            })
          }
          else callback(null, {});
          break;          
        default:
          callback(null, {});
      }
    };

    self.populateCategoryMetatags = function(result, toolName, req){
      switch(toolName)
      {
        case 'magazine':
        {
          if(req.query.category) 
          {
            var category = req.query.category;
            if(!params.category[category]) return false;
            result.metaTags.title = category + ' Magazines Advertising in India >> Rates for '+category+' Magazines Advertisement';            
            result.metaTags.description = category + ' Magazines Advertising is utilized by a variety of brands to reach the target audience. Due to a low cost of distribution and high readership, '+ 
                                          category+' Magazines Advertising Rates have a low CPM. You can explore '+ 
                                          category+' magazines advertising rates and ' + 
                                          category+' magazines advertising cost here.';
            result.metaTags.keyWords = [category +' Magazines in India advertising rates', category +' Magazines in India ad rates', category +' Magazines in India media kit', category +' Magazines in India card rates', category +' Magazines in India advertising', category +' Magazines in India advertising details', category +' Magazines in India pricing details', 'how to advertise in '+category +' Magazines in India', category +' Magazines in India media rates', category +' Magazines in India advertising manager', category +' Magazines in India contact details', category +' Magazines in India advertising contact', category +' Magazines in India media contact', 'magazine advertisements'];                                         
            //result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          break;
        }
        case 'cinema':
        {
          if(req.query.cinemaChain && req.query.city) 
          {
            var cinemaChain = req.query.cinemaChain;
            var city = req.query.city;
            if(params['cinemaChain'].indexOf(cinemaChain) == -1) return false;
            if(!params.city[city]) return false;
            cinemaChain = cinemaChain.replace("Cinemas", '');
            result.metaTags.title = cinemaChain + ' Cinema Advertising in '+city+' >> Rates for '+cinemaChain+' Cinema Advertisement';
            result.metaTags.description = cinemaChain + ' Advertising in '+city+' is utilized by a variety of brands to reach to their target audience. Get access to the list of '+cinemaChain+' Cinema Advertising Screens in '+city+' at The Media Ant. You can explore '+cinemaChain+' Cinema advertising rates and '+cinemaChain+' Cinema advertising cost in here.';
            keyWords = [cinemaChain+' Cinema advertising rates in '+city, cinemaChain+' Cinema in '+city+' ad rates', cinemaChain+' Cinema in '+city+' media kit', cinemaChain+' Cinema in '+city+' card rates', cinemaChain+' Cinema in '+city+' advertising', cinemaChain+' Cinema in '+city+' advertising details', cinemaChain+' Cinema in'+city+' pricing details', 'how to advertise in'+cinemaChain+' Cinema in '+city, cinemaChain+' Cinema in '+city+' media rates',  cinemaChain+' Cinema in '+city+' advertising manager',  cinemaChain+' Cinema in '+city+'contact details', cinemaChain+' Cinema in '+city+' advertising contact', cinemaChain+' Cinema in '+city+' media contact', cinemaChain+' cinema slide advertising in '+city, city + ' ' +cinemaChain+' theatre ads', cinemaChain+' multiplex advertising in '+city, cinemaChain+' audio slide advertising in '+city, cinemaChain+' mute slide advertising in '+city]
            result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          else
          if(req.query.cinemaChain) 
          {
            var cinemaChain = req.query.cinemaChain;            
            if(params['cinemaChain'].indexOf(cinemaChain) == -1) return false;
            cinemaChain = cinemaChain.replace("Cinemas", '');
            result.metaTags.title = cinemaChain+' Cinema Advertising in India >> Rates for '+cinemaChain+' Cinema Advertisement';
            result.metaTags.description = cinemaChain+' Cinema Advertising is enabled in many cities. '+cinemaChain+' Cinema in India is one of the premier multiplex chains. Get access to the list of '+cinemaChain+' Cinema Advertising Screens at The Media Ant. You can explore '+cinemaChain+' Cinema advertising rates and '+cinemaChain+' Cinema advertising cost here.';
            keyWords = [cinemaChain+' Cinema in India advertising rates', cinemaChain+' Cinema in India ad rates', cinemaChain+' Cinema in India media kit', cinemaChain+' Cinema in India card rates', cinemaChain+' Cinema in India advertising', cinemaChain+' Cinema in India advertising details', cinemaChain+' Cinema in India pricing details', 'how to advertise in '+cinemaChain+' Cinema in India', cinemaChain+' Cinema in India media rates', cinemaChain+' Cinema in India advertising manager', cinemaChain+' Cinema in India contact details', cinemaChain+' Cinema in India advertising contact', cinemaChain+' Cinema in India media contact', cinemaChain+' cinema slide advertising', cinemaChain+' theatre ads',  cinemaChain+' multiplex advertising', cinemaChain+' audio slide advertising', cinemaChain+' mute slide advertising']
            result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          else
          if(req.query.city) 
          {
            var city = req.query.city;
            if(!params.city[city]) return false;
            result.metaTags.title = 'Cinema Advertising in '+city+' >> Rates for '+city+' Cinema Advertisement';
            result.metaTags.description = city+' Cinema Advertising is an excellent medium for premium audience targetting. Cinema Advertising in '+city+' has emerged as a promising advertising platform. For this demography theatre is a primary medium of entertainment. You can explore '+city+' Cinema Advertising Rates & '+city+' Cinema Advertising Costs here.';
            keyWords = ['Cinema advertising rates in '+city, 'Cinema ad rates in ' +city, city+' Cinema media kit', city+' Cinema card rates', city+' Cinema advertising details', city+' Cinema pricing details', 'how to advertise in '+city+' Cinemas', city+' Cinema media rates', city+' Cinema advertising manager', city+' cinema contact details', 'Cinema in '+city+' advertising contact', 'Cinema in '+city+' media contact'];
            result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          break;
        }
        case 'radio':
        {
          if(req.query.station) 
          {
            var station = req.query.station;
            if(params.station.indexOf(station) == -1) return false;
            result.metaTags.title = station+' Advertising in India >> Rates for '+station+' Advertisement';
            result.metaTags.description = station+' Advertising is enabled in many cities. '+station+' Advertising is utilized by a variety of brands to reach out to their target audience. '+station+' is a renowned radio channel with a strong foot-hold in India. We have absolute access to the ad inventory of '+station+'. You can explore '+station+' Advertising Rates & '+station+' Advertising Costs here.';
            keyWords = [station+' in India advertising rates', station+' in India ad rates', station+' in India media kit', station+' in India card rates', station+' in India advertising', station+' in India advertising details', station+' in India pricing details', 'how to advertise in '+station+' in India', station+' in India media rates', station+' in India advertising manager', station+' in India contact details', station+' in India advertising contact', station+' in India media contact', station+' station advertising', station+' jingle ads', station+' RJ mentions', station+' RODP', station+' Primetime', station+' radio ad spots'];
            result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          else
          if(req.query.city) 
          {
            var city = req.query.city;
            if(params.city.indexOf(city) == -1) return false;
            result.metaTags.title = 'Radio Advertising in '+city+' >> Rates for '+city+' Radio Advertisement';
            result.metaTags.description = 'Radio Advertising in '+city+' is an excellent medium for mass audience targetting. Radio Advertising in '+city+' has emerged as a promising advertising platform. '+city+' Radio advertising is utilized by a variety of brand categories. You can explore '+city+' Radio Advertising Rates and '+city+' Radio Advertising costs here.';
            keyWords = ['Radio advertising rates in ' +city, 'Radio ad rates in ' +city, city+' Radio media kit', city+' Radio card rates', city+' Radio advertising details', city+' Radio pricing details', 'how to advertise in '+city+' Radios', city+' Radio media rates', city+' Radio advertising manager', city+' Radio contact details', 'Radio in '+city+' advertising contact', 'Radio in '+city+' media contact', city+' jingle ads', city+' RJ mentions', city+' RODP', city+' radio ad spots'];
            result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          break;
        }
        case 'newspaper':
        {
          if(req.query.category) 
          {
            // var category = req.query.category;
            // if(!params.category[category]) return false;
            // result.metaTags.title = category+' Newspaper Advertising in India >> Rates for '+category+' Newspaper Advertisement';
            // result.metaTags.description = category+' Newspapers Advertising is utilized by a variety of brands to reach out to their target audience. Due to a low cost of distribution and high readership, '+category+' Newspapers Advertising Rates have a low CPM. You can explore '+category+' Newspapers advertising rates and '+category+' Newspapers advertising cost here.';
            // keyWords = [category +' Newspapers in India advertising rates', category +' Newspapers in India ad rates', category +' Newspapers in India media kit', category +' Newspapers in India card rates', category +' Newspapers in India advertising', category +' Newspapers in India advertising details', category +' Newspapers in India pricing details', 'how to advertise in '+category +' Newspapers in India', category +' Newspapers in India media rates', category +' Newspapers in India advertising manager', category +' Newspapers in India contact details', category +' Newspapers in India advertising contact', category +' Newspapers in India media contact'];
            // result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);            
            result.metaTags = result.categoryPage.category.metaTags;
            console.log(result);
            return result;
          }
          break;
        }


      }
      
    };

    self.createMatchForToolsMetaTags = function(req, params, toolName, toolId){
      var match = {};
      match.isActive = 1;
      match.toolId = toolId;
      if(!req.query.category && !req.query.city && !req.query.station && !req.query['cinemaChain'])
        return match;
      switch(toolName)
      {
        case 'magazine':
        case 'newspaper':
          if(req.query.category) match.categoryId = params.category[req.query.category];
          break;
        case 'radio':
          if(req.query.station) match.station = req.query.station;
          if(req.query.city) match.city = req.query.city;
          break;
        case 'cinema':
          if(req.query['cinemaChain']) match['cinemaChain'] = req.query['cinemaChain'];
          if(req.query.city) match.geography = { "$in":params.city[req.query.city] };
          break;
      }
      return match;
    };

  this.getMediaName = function(req, res){
    var toolId = req.query.toolName;
    var search = new RegExp('\\b'+req.query.mediaName, "i");
    Media.find({ name:search, toolId:toolId },{ name:1, _id:1 }).lean().exec(function(err, medias){
      res.status(200).json({medias:medias});
    });
  };

  this.saveCampaigns =function(req, res){
    // create a new campaign
      var newCampaign = SaveCampaigns(req.body);

    // save the campaign
      newCampaign.save(function(err) {
        if(err) return res.status(500).json(err);
        res.status(200).json("Campaign Created Successfully");
      });
  }

  this.getMoreSeller = function(req, res){
    var params = req.query;
    var media = ["all"];
    media.push(params.media);
    var mediaOption = ["all"];
    mediaOption.push(params.mediaOption);
    var tool = ["all"];
    tool.push(params.tool);

    TwelthCross.find({servicesOffered: {$elemMatch: { media:{ $in: media }, mediaOption:{ $in: media }, tool:{ $in: tool } }}},
      { "name":1, "imageUrl": 1, "urlSlug": 1},
      function(err, results){
        if(err) return res.status(500).json(err);
        return res.status(200).json(results);
    });
  }

  this.leadCount = function(req, res){
    date = new Date();
    emailUserIds = [];
    campaignUserIds = [];
    finalData = [];

    BestRatesEmail.find(
      {"createdAt" : {$gte : (date.getTime() - (15 * 24 * 60 * 60 * 1000))}}, 
      {"userID" : 1, "createdAt" : 1, "emailContent.name": 1, "emailContent.tool" : 1 }
    ).sort( { "createdAt": -1 } )
    .lean().exec(
      function(errEmail, emailData)
      {
        for(i in emailData) emailUserIds.push(emailData[i].userID)
        CommonLib.getUserInfo(emailUserIds, function(err, userInfo){
          for(i in emailData) { emailData[i].userID = userInfo[emailData[i].userID].email;}
          for(i in emailData) { finalData.push(emailData[i]) }            

          //Campaign data
          CampaignRatesEmail.find(
            {"createdAt" : {$gte : (date.getTime() - (15 * 24 * 60 * 60 * 1000))}}, 
            {"userID" : 1, "createdAt" : 1, "emailContent.name": 1, "emailContent.tool" : 1 }
          ).sort( { "createdAt": -1 } ).
          lean().exec(
            function(errEmail, campaignsData)
            {
              for(i in campaignsData) campaignUserIds.push(campaignsData[i].userID)
              CommonLib.getUserInfo(campaignUserIds, function(err, userInfo){
                for(i in campaignsData) { campaignsData[i].userID = userInfo[campaignsData[i].userID].email;}
                for(i in campaignsData) { finalData.push(campaignsData[i]) }

                Contact.find(
                  {"createdAt" : {$gte : (date.getTime() - (15 * 24 * 60 * 60 * 1000))}}
                ).sort( { "createdAt": -1 } ).
                lean().exec(
                  function(errEmail, contactData)
                  {
                    for(i in contactData) { finalData.push(contactData[i]) }
                    res.status(200).json("success");
                    excelContent = self.createExcel(finalData); 
                  }
                ); 
              });
            }
          );
        });          
      }
    );
  };

  self.createExcel = function(data){
    self.path = [];     
    var length = parseInt(data.length);
    var pathExcel = 'public/leadCount';
    date = new Date();
    var number = self.path.length + 1;        
    var file_name = 'leadCount'+date+'.xlsx';
    self.filename = file_name;
    self.path.push(pathExcel+'/'+file_name);
    var workbook = excelbuilder.createWorkbook(pathExcel, file_name);
    // Create a new worksheet with 10 columns and 12 rows 
    var sheet1 = workbook.createSheet('sheet1', data.length, 2000);

    // Fill some data
    sheet1.set(1, 1, 'Email');
    sheet1.set(2, 1, 'Date');
    sheet1.set(3, 1, 'Data');
    var com = [];
    for(var i= 0; i<data.length; i++){          
      if(data[i].emailContent){
        var mediaCategory = data[i].emailContent.map(function(item) {
            return item.tool + ' | ' + item.name+' ||..|| ';
          });
        sheet1.set(1, i+2, data[i].userID);
        sheet1.set(2, i+2, data[i].createdAt);
        sheet1.set(3, i+2, mediaCategory);
      }
      else{
        sheet1.set(1, i+2, data[i].email);
        sheet1.set(2, i+2, data[i].createdAt);
        sheet1.set(3, i+2, data[i].toolName + ' |  Request for Assistance and url is' + data[i].urlGiven);
      }                  
    }

    // Save it
    workbook.save(function(err){
      if (err) {
          workbook.cancel();
          //res.status(500).json(err);
          //return 0;
      }
      else {
          //res.status(200).json("success");
          //return 1;
          var attachments = [{
            path: pathExcel+'/'+file_name
          }];

          var mailOptions = {
          appHost: self.config.appHost,
          emailContent: data,
          currentDate : date
          };

          var emailTemplate = new EmailTemplate(path.join(templatesDir, 'leadCount'));
          emailTemplate.render(mailOptions, function(err, results){
            if(err) return console.error(err)
            self.transporter.sendMail({
              from: "help@themediaant.com", // sender address
              to: "help@themediaant.com", // list of receivers
              cc: "videsh@themediaant.com",
              subject: 'Lead Count as on - '+date,
              html: results.html,
              attachments: attachments
            }, function(err, responseStatus){
              if(err) return console.error(err);
               console.log("Lead Count mail sent")
            })
          });
      }
    });      
  };

  this.hirePlanner = function(req, res){
    // create a new entry
    req.body.createdAt = new Date();
    req.body.visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip
    };

    var token = req.body.token || req.query.Tokenn || req.headers['x-access-token'];
    if(!token) return res.status(401).json("Token not found");
    else
    {
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(407).json("Invalid Token");
        else 
        {
          req.body.userId = decoded._id;
          self.saveHirePlanner(req, res);
        } 
      });
    }
  };

  this.tags = function(req, res){
    var qString = req.query.q;    
    var query = {
      q: qString,
      tool: 'tag',
    };
    
    CommonLib.getTags(query, function(err, tags){
      return res.status(200).json({tags:tags, count : tags.length});
    })       
  }

  self.saveHirePlanner = function(req, res){
    var newPlan = HirePlanner(req.body);
    // save the plan
    newPlan.save(function(err){
      if(err) return res.status(500).json(err);
      res.status(200).json("Plan saved Successfully");

      if(!req.body.userId) 
      {
        var user = {
          userName : 'A user', 
          plannerName : 'Samcho', 
          plannerEmail : 'samir@themediaant.com',
          userEmail : 'manjunath@themediaant.com',
          plan: req.body
        };
        self.emailHirePlanner(user);
      }
      else
      {
        User.findOne({ _id:req.body.userId }).lean().exec(function(err, result){
          console.log(result);
          var user = {
            userName : result.firstName + ' ' + result.lastName, 
            plannerName : 'Samcho', 
            plannerEmail : 'samir@themediaant.com',
            userEmail : result.email,
            plan: req.body
          };
          self.emailHirePlanner(user);
        });
      }
    });
  };

  self.emailHirePlanner = function(user){
    var mailOptions = {
      data: user,
      appHost:self.config.appHost
    };

    var emailTemplate = new EmailTemplate(path.join(templatesDir, 'hirePlanner'));

    emailTemplate.render(mailOptions, function(err, results){
      if(err) return console.error(err)
      self.transporter.sendMail({
        from: self.config.noreply, // sender address
        to: user.plannerEmail, // list of receivers
        cc: user.userEmail,
        subject: 'Request to hire a Planner - The Media Ant',
        html: results.html
      }, function(err, responseStatus){
        if(err) return console.log('here',err);
         console.log("responseStatus.message");                         
      })
    });
  };

};

module.exports.CommonCtrl = Common;
