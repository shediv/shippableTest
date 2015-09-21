var Search = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  var Tools = require('../models/tool').Tools;
  
  var self = this;

  this.getResults = function(req, res){
    var query = req.query.q;
    query = query.split(' ');
    for(i in query)
    {
      var qRegExp = new RegExp('\\b'+query[i], "i");
      query[i] = qRegExp;
    }
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
        'logo' : 1,
        'toolId' : 1,
        'views' : 1
      };
      var match = { searchKeyWords:{ $all:query } };
      var finalResults = [];
      Media.aggregate( 
        { $match:match },
        { $project:project },
        { $group:{ _id:'$toolId', medias:{ $push:'$$ROOT' } } },
        function(err, results)
        {
          async.each(results, function(result, callbackEach){
            Tools.findOne({ _id:result._id },'name').lean().exec(function(err, tool){
              result['medias'] = result['medias'].slice(0, 10);
              for(i in result['medias'])
              {
                result['medias'][i].toolName = tool.name;
                finalResults.push(result['medias'][i]);
              }
              callbackEach(err);
            });
          }, function(err){
            callback(err, finalResults);
          });
        }
      );
    }

    self.searchTwelthCross = function(query, callback){
      var project = {
        'name' : 1,
        'urlSlug' : 1,
        'logo' : 1
      };
      TwelthCross.find({ searchKeyWords:{ $in:query } }, project).skip(0).limit(10).lean().exec(function(err, results){
        callback(err, results);
      });
    }

};

module.exports.Search = Search;