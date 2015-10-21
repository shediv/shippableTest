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
  this.config = require('../config/config.js');
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
            var find = '-';
            var regExp = new RegExp(find, 'g');
            toolName = toolName.replace(regExp, ' ').split(' ');
            for(i in toolName)
            {
              if( SearchIgnore.indexOf(toolName[i]) > -1 ) continue;
              var qRegExp = new RegExp('\\b'+toolName[i], "i");
              toolName[i] = qRegExp;
            }
            Media.find({ searchKeyWords:{ $all:toolName } }).lean().exec(function(err, media){
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
          { $project: { url: { $concat: [ "http://www.", self.config.appHost,"/12thcross/", "$urlSlug" ] } } },
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
          { $project: { url: { $concat: [ "http://www.", self.config.appHost,"/chakra/redirect?url=", "$url" ] } } },
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
          { $project: { url: { $concat: [ "http://www.", self.config.appHost,"/", "$name" ] } } },
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
          data.push('http://www.'+self.config.appHost+'/'+results.media[i]._id+'/'+results.media[i].medias[j]);
      }
      toolUrl = ['http://www.themediaant.com/magazine', 'http://www.themediaant.com/cinema', 'http://www.themediaant.com/newspaper', 'http://www.themediaant.com/radio', 'http://www.themediaant.com/television', 'http://www.themediaant.com/outdoor', 'http://www.themediaant.com/airport', 'http://www.themediaant.com/digital', 'http://www.themediaant.com/nontraditional'];
      data = data.concat(results.twelthCross);
      data = data.concat(results.cafe);
      data = data.concat(results.tool);
      res.status(200).json({url:data, count:data.length});
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
        description : 'The Media Ant is a platform where you can advertise on various media verticals like magazine, newspaper, cinema, radio, etc.',
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
      TwelthCross.distinct('urlSlug',{},function(err, medias){
        if(err) return res.status(500).json(err);
        return res.status(200).json({
          title : '12th Cross || The Media Ant',
          description : 'List of agencies servicingon various medias',
          image : 'image',
          twitter : self.config.twitter,
          facebook : self.config.facebook,
          medias : medias,
          keyWords : []
        });
      });
    }
    else
    if(toolName == 'cafe')
    {
      return res.status(200).json({
        title : 'Cafe || The Media Ant',
        description : 'Cafe, browse popular URLs and articles',
        image : 'image',
        twitter : self.config.twitter,
        facebook : self.config.facebook,
        medias : [],
        keyWords : []
      });
    }
    else
    {
      Tools.findOne({ name:toolName },{ metaTags:1 }).lean().exec(function(err, result){
        if(!result) {console.log('Meta error: ',toolName); return res.status(404).json({status:"NOT OK"});}
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
        Media.distinct('urlSlug',{ toolId:result._id },function(err, medias){
          if(err) return res.status(500).json(err);
          result.metaTags.medias = medias;
          return res.status(200).json(result.metaTags);  
        });
      });
    }
  }

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
