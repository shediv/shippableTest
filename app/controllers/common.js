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
        Media.findOne( {urlSlug:decodeURI(toolName)} ).lean().exec(function(err, media){
          if(!media)
          {
            var find = '-';
            var regExp = new RegExp(find, 'g');
            toolName = toolName.replace(regExp, ' ');
            var find = '_';
            var regExp = new RegExp(find, 'g');
            toolName = toolName.replace(regExp, ' ').split(' ');
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
    if(req.body.toolName) { toolName =  CommonLib.capitalizeFirstLetter(req.body.toolName);  }    
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
          subject: mailOptions.toolName+' - Request for Assistance ',
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
          {$match: {"urlSlug": { $exists: 1} }},
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
          {$match: {"urlSlug": { $exists: 1}, "toolId": { $exists: 1} }},
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
          data.push(encodeURI('http://'+self.config.appHost+'/'+results.media[i]._id+'/'+results.media[i].medias[j]));
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
            cats[i] = encodeURI('http://'+self.config.appHost+'/'+tool.name+'?category='+cats[i]);
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
              results[i] = encodeURI('http://'+self.config.appHost+'/'+tool.name+'?station='+results[i]);
            callback(err, results);
          });
        },
        city : function(callback)
        {
          Media.distinct('city', { toolId:tool._id, isActive:1 }, function(err, results){
            for(i in results)
              results[i] = encodeURI('http://'+self.config.appHost+'/'+tool.name+'?city='+results[i]);
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
              results[i] = encodeURI('http://'+self.config.appHost+'/'+tool.name+'?cinemachain='+results[i]);
            callback(err, results);
          });
        },
        city : function(callback)
        {
          Media.distinct('geography', { toolId:tool._id, isActive:1 }, function(err, results){
            Geography.distinct('city', { _id:{ $in:results } }, function(err, cities){
              for(i in cities)
                cities[i] = encodeURI('http://'+self.config.appHost+'/'+tool.name+'?city='+cities[i]);
              callback(err, cities);
            });
          });
        },
        cityPlusCinemaChain : function(callback)
        {
          var cinemaLinks = [];
          Media.distinct('cinemaChain', { toolId:tool._id, isActive:1, cinemaChain:{ $ne:'Single Screen' } }, function(err, chains){
            async.each(chains, function(chain, callbackEach){
              var base = 'http://'+self.config.appHost+'/'+tool.name+'?cinemachain='+chain;
              Media.distinct('geography', { toolId:tool._id, isActive:1, cinemaChain:chain }, function(err, geos){
                Geography.distinct('city', { _id:{ $in:geos } },function(err, cities){
                  for(i in cities) cinemaLinks.push(encodeURI(base + '&city=' + cities[i]));
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
        if(!result) {console.log('Meta error: ',toolName); return res.status(404).json({status:"NOT OK"});}
        result = self.populateCategoryMetatags(result, toolName, req);
        Media.distinct('urlSlug',{ toolId:result._id },function(err, medias){
          if(err) return res.status(500).json(err);
          result.metaTags.medias = medias;
          return res.status(200).json(result.metaTags);  
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

    self.populateCategoryMetatags = function(result, toolName, req){
      switch(toolName)
      {
        case 'magazine':
        {
          if(req.query.category) 
          {
            var category = req.query.category;
            result.metaTags.title = category + " Magazine Advertising in India";
            result.metaTags.description = "Advertise in "+category+" Magazines via TheMediaAnt. "+category+" Magazines in India are utilized to advertise a great variety of products. Find the best "+category+" Magazines advertising rates in India through The Media Ant.";
          }
          break;
        }
        case 'cinema':
        {
          if(req.query.cinemaChain && req.query.city) 
          {
            var cinemaChain = req.query.cinemaChain;
            var city = req.query.city;
            result.metaTags.title = cinemaChain + " Cinema Advertising in " + city;
            result.metaTags.description = "Advertise in "+cinemaChain+" in "+city+" via TheMediaAnt. "+cinemaChain+" is one of the leading multiplex chains in India. "+cinemaChain+" Theatres in "+city+" have emerged as a promising advertising plaform for multiple brands. Get access to the list of "+cinemaChain+" Advertising Screens in "+city+" at The Media Ant. Find the best "+city+" "+cinemaChain+" advertising rates here.";
          }
          else
          if(req.query.cinemaChain) 
          {
            var cinemaChain = req.query.cinemaChain;
            result.metaTags.title = cinemaChain + " Cinema Advertising in India";
            result.metaTags.description = "Advertise in "+cinemaChain+" in India via TheMediaAnt. "+cinemaChain+" in India is one of the premier multiplex chains. "+cinemaChain+" Advertising is enabled in many cities. Get access to the list of "+cinemaChain+" Advertising Screens at The Media Ant. Find the best Inox cinema advertising rates here.";
          }
          else
          if(req.query.city) 
          {
            var city = req.query.city;
            result.metaTags.title = city + " Cinema Advertising";
            result.metaTags.description = "Advertise in "+city+" cinemas via TheMediaAnt. "+city+" is one of India's premier cities with a youth & family strong demographic. For this demography theatre is a primary medium of entertainment. You can explore "+city+" Cinema Advertising Rates & "+city+" Cinema Advertising Costs here.";
          }
          break;
        }
        case 'radio':
        {
          if(req.query.station) 
          {
            var station = req.query.station;
            result.metaTags.title = station + " Radio Advertising in India";
            result.metaTags.description = "Advertise in "+station+" in India via TheMediaAnt. "+station+" is a renowned radio channel with a strong foot-hold in India. We have absolute access to the advertising inventory of "+station+". Get access to the list of "+station+" Advertising Stations at The Media Ant. Find the best "+station+" advertising rates here.";
          }
          else
          if(req.query.city) 
          {
            var city = req.query.city;
            result.metaTags.title = city + " Radio Advertising";
            result.metaTags.description = "Advertise in "+city+" Radio Station via TheMediaAnt. Radio Advertising in "+city+" has emerged as a promising advertising platform. "+city+" Radio Advertising is utilized by a variety of brand categories. Get access to the list of "+city+" Radio Advertising Stations at The Media Ant. Find the best "+city+" radio station advertising rates here.";
          }
          break;
        }
        case 'newspaper':
        {
          if(req.query.category) 
          {
            var category = req.query.category;
            result.metaTags.title = category + " Newspaper Advertising in India";
            result.metaTags.description = "Advertise in "+category+" Newspapers in India via TheMediaAnt. "+category+" Newspapers advertisement appears alongside regular editorial content.The list of "+category+" Newspapers in India display ads contain text, photographs,logos, maps, and other informational items. Find the best "+category+" Newspaper Advertising rates through The Media Ant.";
          }
          break;
        }
      }
      return result;
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
