var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  var CustomerQuery = require('../models/customerQuery').CustomerQuery;
  
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
    var customerQuery = CustomerQueries(req.body);
    customerQuery.save(function(err,result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(500).json("NOT OK");
      res.status(200).json('OK');
    });
  }
  
};

module.exports.CommonCtrl = Common;