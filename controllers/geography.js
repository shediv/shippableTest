var Geography = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;

  var underscore = require("underscore");

  this.params = {};
  this.toolName = "magazine";
  var scope = this;

    scope.createGeography = function(req, res){
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