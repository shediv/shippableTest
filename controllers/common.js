var Common = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Tools = require('../models/tool').Tools;
  
  this.isToolExists = function(req, res){
    var toolName = req.query.toolName;
    console.log(toolName);
    Tools.findOne({ name:toolName }, function(err, result){
      if(!result) return res.status(404).json("NOT OK");
      return res.status(200).json("OK");
    });
  }
  
};

module.exports.CommonCtrl = Common;