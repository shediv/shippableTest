var Media = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;

  this.params = {};
  this.toolName = "magazine";
  var scope = this;
  
  Tools.findOne({name: this.toolName}, function(err, result){
    //console.log();
    scope.toolId = result._id.toString();
  });

    scope.createMedia = function(req, res){
        // create a new Media
        var newMedia = Media(req.body);

        // save the Media
        newMedia.save(function(err) {
          if (err) throw err;
          //console.log('User created!');
          res.status(200).json(newMedia);
        });
    };

}    


module.exports.Med = Media;