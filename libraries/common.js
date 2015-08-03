var Common = function()
{
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;

  var scope = this;
  
  this.getCategoryName = function(catIds, callback)
  {
    Category.find({_id : {$in: catIds}},'name').lean().exec(function(err, results){
      var categoryNames = [];
      for(var i = 0; i < results.length; i++)
        categoryNames[results[i]._id] = results[i].name;
      callback(err, categoryNames);
    });
  }

  this.removeHiddenAttributes = function(attributes){
    for(key in attributes)
    {
      if(attributes[key].hidden) delete attributes[key];
    }
    return attributes;
  }

};

module.exports.Common = new Common();