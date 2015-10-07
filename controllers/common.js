var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  var CustomerQuery = require('../models/customerQuery').CustomerQuery;
  var Media = require('../models/media').Media;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  this.config = require('../config.js');
  var self = this;
  
  this.isToolExists = function(req, res){
    var toolName = req.query.toolName;
    console.log(toolName);
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
    Tools.findOne({ name:toolName },{ metaTags:1 }).lean().exec(function(err, result){
      if(err) return res.status(500).json(err);
      res.status(200).json(result.metaTags);
    });
  }

  this.getMediaName = function(req, res){
    var toolName = req.query.toolName;
    var search = new RegExp('\\b'+req.query.mediaName, "i");
    Tools.findOne({ name:toolName }).lean().exec(function(err, tool){
      Media.find({ name:search, toolId:tool._id },{ name:1, _id:1 }).lean().exec(function(err, medias){
        res.status(200).json({medias:medias});
      });
    });
  };
};

module.exports.CommonCtrl = Common;