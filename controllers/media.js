var Media = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;

  this.params = {};
  var self = this;
  
  self.store = function(req, res){
    // create a new Media
    var newMedia = Media(req.body);

    // save the Media
    newMedia.save(function(err) {
      if(err) return res.status(500).json(err);
      res.status(200).json("Media Created Successfully");
    });
  };
}    

module.exports.Media = Media;