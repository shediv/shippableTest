var Search = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  
  var self = this;

  this.getResults = function(req, res){
    var query = req.query.q;
    query = query.split(' ');
    for(i in query)
    {
      var qRegExp = new RegExp('\\b'+query[i], "i");
      query[i] = qRegExp;
    }
    console.log(query);
    async.parallel({
      medias : function(callback){ self.searchMedias(query, callback) },
      twelthCross : function(callback){ self.searchTwelthCross(query, callback) }
    },function(err, results){
      res.status(200).json({results:results});
    })
  };

    self.searchMedias = function(query, callback){
      var project = {
        'name' : 1,
        'urlSlug' : 1,
        'logo' : 1
      };
      Media.find({ searchKeyWords:{ $in:query } }, project).lean().exec(function(err, results){
        callback(err, results);
      });
    }

    self.searchTwelthCross = function(query, callback){
      var project = {
        'name' : 1,
        'urlSlug' : 1,
        'logo' : 1
      };
      TwelthCross.find({ searchKeyWords:{ $in:query } }, project).lean().exec(function(err, results){
        callback(err, results);
      });
    }

};

module.exports.Search = Search;