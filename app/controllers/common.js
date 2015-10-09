var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  var CustomerQuery = require('../models/customerQuery').CustomerQuery;
  var Media = require('../models/media').Media;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  var SaveCampaigns = require('../models/saveCampaigns').SaveCampaigns;
  this.config = require('../config/config.js');
  var self = this;
  
  this.isToolExists = function(req, res){
    var toolName = req.query.toolName;
    if(toolName == '12thcross') return res.status(200).json("OK");
    Tools.findOne({ name:toolName }, function(err, result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(404).json("NOT OK");
      return res.status(200).json("OK");
    });
  }

  this.addCustomerQuery = function(req, res){
    req.body.userAgent = req.headers['user-agent'];
    req.body.remoteAddress = req.connection.remoteAddress;
    var customerQuery = CustomerQuery(req.body);
    customerQuery.save(function(err,result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(500).json("NOT OK");
      res.status(200).json('OK');
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
          {$match: {"urlSlug": { $exists: 1} }},
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
      }        
    },
    function(err, results) 
    {
      var data = [];      
      if(err) return res.status(500).json(err);
      for(i in results.media) 
      {
        for(j in results.media[i].medias) 
          data.push('http://'+self.config.appHost+'/'+results.media[i]._id+'/'+results.media[i].medias[j]);
      }        
      data = data.concat(results.twelthCross);
      res.status(200).json({url:data});
    });
  };

  this.getMetaTags = function(req, res){
    var toolName = req.params.toolName;
    if(toolName == '12thcross')
    {
      return res.status(200).json({
        title : '12th Cross || Question & Answer Forum || The Media Ant',
        description : '12th Cross is a question and answers forum for advertising and related mediums',
        image : 'image',
        twitter : self.config.twitter,
        facebook : self.config.facebook
      });
    }
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
    Tools.findOne({ name:toolName },{ metaTags:1 }).lean().exec(function(err, result){
      if(err) return res.status(500).json(err);
      res.status(200).json(result.metaTags);
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.connection.remoteAddress,
      type: 'tool',
      tool: toolName
    };
    CommonLib.uniqueVisits(visitor);
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