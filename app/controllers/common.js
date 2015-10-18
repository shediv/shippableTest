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
              if(!media.length) return res.status(404).json("NO MEDIAS FOUND");
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
    CommonLib.uniqueVisits(visitor);

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
          title : '12th Cross || Question & Answer Forum || The Media Ant',
          description : '12th Cross is a question and answers forum for advertising and related mediums',
          image : 'image',
          twitter : self.config.twitter,
          facebook : self.config.facebook,
          medias : medias
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
        facebook : self.config.facebook
      });
    }
    else
    {
      Tools.findOne({ name:toolName },{ metaTags:1 }).lean().exec(function(err, result){
        if(!result) {console.log('Meta error: ',toolName); return res.status(500).json("NOT OK");}
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
