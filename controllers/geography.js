var Geography = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Geography = require('../models/geography').Geography;

  this.params = {};
  var self = this;

  self.store = function(req, res){
    // create a new Media
    var newGeography = Geography(req.body);

    // save the Media
    newGeography.save(function(err) {
      if (err) throw err;
      //console.log('User created!');
      res.status(200).json(newGeography);
    });
  };
}    


module.exports.Geo = Geography;