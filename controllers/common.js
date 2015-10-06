var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  var CustomerQuery = require('../models/customerQuery').CustomerQuery;
  var Media = require('../models/media').Media;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  
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
        lsquare : function(callbackInner)
        {          
          TwelthCross.aggregate(
            {$match: {"urlSlug": { $exists: 1} }},
            {$skip : 0}, {$limit: 10},                      
            function(error, twelthCross) 
            {
              for(i in twelthCross) twelthCross[i] = 'http://beta.themediaant.com/12thcross/'+twelthCross[i].urlSlug;
              callbackInner(error, twelthCross);
            }
          );
        },      
        media : function(callbackInner)
        {          
          Media.aggregate(
            {$match: {"urlSlug": { $exists: 1} }},
            {$skip : 0}, {$limit: 200},
            { $group : { _id : "$toolId", count : {$sum : 1}, medias: {$push: "$urlSlug"}}},            
            function(error, results) 
            {
              var toolIds = [];
              var toolName = [];
              for(i in results) toolIds.push(results[i]._id);
                Tools.find({_id : {$in: toolIds}},'name').lean().exec(function(err, tool){                                
                for(i in tool) toolName[tool[i]._id] = tool[i];                  
                for(i in results) results[i]['_id'] = toolName[results[i]._id].name;                  
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
        for(i in results.media) {
          for(j in results.media[i].medias) {  
            data.push('http://beta.themediaant.com/'+results.media[i]._id+'/'+results.media[i].medias[j])
          }
        }
        
        data = data.concat(results.lsquare);
        res.status(200).json({url:data});
      });
    };  
};

module.exports.CommonCtrl = Common;