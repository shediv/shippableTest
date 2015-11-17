var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  var CustomerQuery = require('../models/customerQuery').CustomerQuery;
  var Media = require('../models/media').Media;
  var nodeMailer = require('nodemailer');
  var Contact = require('../models/contact').Contact;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  var Cafe = require('../models/cafe').Cafe;
  var SaveCampaigns = require('../models/saveCampaigns').SaveCampaigns;
  var SearchIgnore = require('../config/searchignore.js');
  var Category = require('../models/category').Category;
  var Geography = require('../models/geography').Geography;
  this.config = require('../config/config.js');
  var underscore = require('underscore');
  var self = this;

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
          self.siteMapToolCategory(tool, callbackInner);
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
      }
    },
    function(err, results)
    {
      return res.status(200).json({url:[].concat(results.magazine, results.newspaper, results.radio, results.cinema)});
    });
  };

    self.siteMapToolCategory = function(tool, callbackInner){
      Media.distinct('categoryId', { toolId:tool._id, isActive:1 }, function(err, results){
        Category.distinct('name', { _id:{ $in:results } }, function(err, cats){
          for(i in cats) 
            cats[i] = 'http://'+self.config.appHost+'/'+tool.name+'?category='+encodeURIComponent(cats[i]);
          callbackInner(err, cats);
        });
      });
    };

    self.siteMapRadioCategory = function(tool, callbackInner){
      async.parallel({
        station : function(callback)
        {
          Media.distinct('station', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'?station='+encodeURIComponent(results[i]);
            callback(err, results);
          });
        },
        city : function(callback)
        {
          Media.distinct('city', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'?city='+encodeURIComponent(results[i]);
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
          Media.distinct('cinemaChain', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = 'http://'+self.config.appHost+'/'+tool.name+'?cinemaChain='+encodeURIComponent(results[i]);
            callback(err, results);
          });
        },
        city : function(callback)
        {
          Media.distinct('geography', { toolId:tool._id, isActive:1 }, function(err, results){
            Geography.distinct('city', { _id:{ $in:results } }, function(err, cities){
              for(i in cities)
                cities[i] = 'http://'+self.config.appHost+'/'+tool.name+'?city='+encodeURIComponent(cities[i]);
              callback(err, cities);
            });
          });
        },
        cityPlusCinemaChain : function(callback)
        {
          var cinemaLinks = [];
          Media.distinct('cinemaChain', { toolId:tool._id, isActive:1, cinemaChain:{ $ne:'Single Screen' } }, function(err, chains){
            async.each(chains, function(chain, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name+'?cinemaChain='+encodeURIComponent(chain);
              Media.distinct('geography', { toolId:tool._id, isActive:1, cinemaChain:chain }, function(err, geos){
                Geography.distinct('city', { _id:{ $in:geos } },function(err, cities){
                  for(i in cities) cinemaLinks.push(base + '&city=' + encodeURIComponent(cities[i]));
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
    var toolName = req.params.toolName;
    if(req.query.category) req.query.category = decodeURIComponent(req.query.category);
    if(req.query.city) req.query.city = decodeURIComponent(req.query.city);
    if(req.query.station) req.query.station = decodeURIComponent(req.query.station);
    if(req.query.cinemaChain) req.query.cinemaChain = decodeURIComponent(req.query.cinemaChain);
    
    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      type: 'tool',
      tool: toolName
    };
    CommonLib.uniqueVisits(visitor);

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
    {
      Tools.findOne({ name:toolName },{ metaTags:1 }).lean().exec(function(err, result){                  
        var tool = result;
        if(!result) {console.log('Meta error: ',toolName); return res.status(404).json({status:"NOT OK"});}
        async.series([
          function(callback)
          {
            self.fetchParamsForCategory(req, tool, toolName, callback);
          }
        ], function(err, params){
          params = params[0];
          //return res.status(200).json(params);
          result = self.populateCategoryMetatags(result, toolName, req, params);

          
          if(!result) return res.status(410).json("NOT FOUND P");
          match = self.createMatchForToolsMetaTags(req, params, toolName, tool._id);
          //return res.status(200).json(match);
          var project = {
            'urlSlug' : 1,
            'name' : 1,
            //For Cinema
            'theatreName' : 1,
            'resultMallName' : 1,
            'cinemaChain' : 1,
            'mallName' : 1,
            //For Radio
            'station' : 1,
            'city' : 1,
            'type' : 1,
            //For Newspaper
            'areaCovered' : 1,
            'editionName' : 1,
            //For Digital
            'medium' : 1
          };
          Media.find(match, project).lean().exec(function(err, medias){
            if(err) return res.status(500).json(err);
            medias.map(function(media){ media = CommonLib.formMediaName(media, toolName); });
            result.metaTags.medias = medias;
            return res.status(200).json(result.metaTags);  
          });
        });
      });
    }
  }

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

    self.fetchParamsForCategory = function(req, tool, toolName, callback){
      if(!req.query.category && !req.query.city && !req.query.station && !req.query['cinemaChain'])
        return callback(null, {});
      switch(toolName)
      {
        case 'magazine':
        case 'newspaper':
          if(req.query.category)
          {
            Media.distinct('categoryId', { toolId:tool._id, isActive:1 }, function(err, results){
              for(i in results) results[i] = results[i].toString();
              Category.find({ _id:{ $in:results }, name:req.query.category }).lean().exec(
                function(err, cats){
                  if(err) console.log(err);
                  var categories = {};
                  for(i in cats) categories[cats[i].name] = cats[i]._id;
                  callback(err, {category:categories});
                }
              );
            });
          } else callback(null, {});
          break;
        case 'radio':
          async.parallel({
            station : function(callbackInner)
            {
              if(req.query.station)
              {
                Media.distinct('station', { toolId:tool._id, station:req.query.station, isActive:1 }, function(err, results){
                  callbackInner(err, results);
                });
              } else callbackInner(null, []);
            },
            city : function(callbackInner)
            {
              if(req.query.city)
              {
                Media.distinct('city', { toolId:tool._id, city:req.query.city, isActive:1 }, function(err, results){
                  callbackInner(err, results);
                });  
              } else callbackInner(null, []);
            }
          },function(err, results){
            callback(err, results);
          });
          break;
        case 'cinema':
          async.parallel({
            cinemaChain : function(callbackInner)
            {
              if(req.query['cinemaChain'])
              {
                Media.distinct('cinemaChain', { toolId:tool._id, isActive:1 }, function(err, results){
                  callbackInner(err, results);
                });  
              } else callbackInner(null, []);
            },
            city : function(callbackInner)
            {
              if(req.query.city)
              {
                Geography.distinct('_id', { city:req.query.city, pincode:{ $exists:true } }, 
                  function(err, cities){
                    if(!cities.length) return callbackInner(null, {});
                    for(i in cities) cities[i] = cities[i].toString();
                    Media.distinct('geography', { geography:{ $in:cities }, toolId:tool._id, isActive:1 }, 
                      function(err, results){
                        var params = {};
                        params[req.query.city] = results;
                        callbackInner(err, params);
                      }
                    );
                  }
                );
              } else callbackInner(null, {});
            }
          },function(err, results){
            callback(err, results);
          });
          break;
        default:
          callback(null, {});
      }
    };

    self.populateCategoryMetatags = function(result, toolName, req, params){
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
            var category = req.query.category;
            if(!params.category[category]) return false;
            result.metaTags.title = category+' Newspaper Advertising in India >> Rates for '+category+' Newspaper Advertisement';
            result.metaTags.description = category+' Newspapers Advertising is utilized by a variety of brands to reach out to their target audience. Due to a low cost of distribution and high readership, '+category+' Newspapers Advertising Rates have a low CPM. You can explore '+category+' Newspapers advertising rates and '+category+' Newspapers advertising cost here.';
            keyWords = [category +' Newspapers in India advertising rates', category +' Newspapers in India ad rates', category +' Newspapers in India media kit', category +' Newspapers in India card rates', category +' Newspapers in India advertising', category +' Newspapers in India advertising details', category +' Newspapers in India pricing details', 'how to advertise in '+category +' Newspapers in India', category +' Newspapers in India media rates', category +' Newspapers in India advertising manager', category +' Newspapers in India contact details', category +' Newspapers in India advertising contact', category +' Newspapers in India media contact'];
            result.metaTags.keyWords = result.metaTags.keyWords.concat(keyWords);
          }
          break;
        }
      }
      return result;
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

};

module.exports.CommonCtrl = Common;
