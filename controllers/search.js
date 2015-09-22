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
        'views' : 1,
        'theatreName' : 1,
        'resultMallName' : 1,
        'cinemaChain' : 1,
        'mallName' : 1,
        'station' : 1,
        'city' : 1
      };
      var match = { searchKeyWords:{ $all:query } };
      var finalResults = [];
      Media.aggregate( 
        { $match:match },
        { $project:project },
        { $group:{ _id:'$toolId', medias:{ $push:'$$ROOT' } } },
        function(err, results)
        {
          results.sort(function(a,b){ return a.medias.length < b.medias.length });
          async.each(results, function(result, callbackEach){
            Tools.findOne({ _id:result._id },'name').lean().exec(function(err, tool){
              result['medias'] = result['medias'].slice(0, 10);
              for(i in result['medias'])
              {
                result['medias'][i].toolName = tool.name;
                if(result['medias'][i].resultMallName !== undefined)
                {
                  result['medias'][i].name = result['medias'][i].theatreName + ', ' + result['medias'][i].resultMallName;
                  delete result['medias'][i].theatreName;
                  delete result['medias'][i].resultMallName;
                  delete result['medias'][i].cinemaChain;
                }
                if(result['medias'][i].mallName !== undefined)
                {
                  result['medias'][i].name = result['medias'][i].cinemaChain + ', ' + result['medias'][i].mallName;
                  delete result['medias'][i].mallName;
                  delete result['medias'][i].cinemaChain;
                }
                if(result['medias'][i].station !== undefined)
                {
                  result['medias'][i].name = result['medias'][i].station + ', ' + result['medias'][i].city;
                  delete result['medias'][i].station;
                  delete result['medias'][i].city; 
                }
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
        'logo' : 1,
        'views' : 1,
      };
      TwelthCross.find({ searchKeyWords:{ $all:query } }, project).skip(0).limit(10).lean().exec(function(err, results){
        callback(err, results);
      });
    }

};

module.exports.Search = Search;