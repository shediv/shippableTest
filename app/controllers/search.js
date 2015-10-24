var Search = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  var Tools = require('../models/tool').Tools;
  var SearchIgnore = require('../config/searchignore.js');
  
  var self = this;
  self.nameQuery = '';

  this.getResults = function(req, res){
    Tools.distinct('name',{},function(err, tools){
      var queryTerms = req.query.q;
      self.nameQuery = '';
      queryTerms = queryTerms.split(' ');
      var query = [];
      for(i in queryTerms)
      {
        if( SearchIgnore.indexOf(queryTerms[i]) > -1 ) continue;
        var qRegExp = new RegExp('\\b'+queryTerms[i], "i");
        query.push(qRegExp);
        if( tools.indexOf(queryTerms[i]) <= -1 ) self.nameQuery += ' ' + queryTerms[i];
      }
      self.nameQuery = new RegExp('\\b'+self.nameQuery.trim(), "i");;
      async.parallel({
        medias : function(callback){ self.searchMedias(query, callback) },
        twelthCross : function(callback){ self.searchTwelthCross(query, callback) }
      },function(err, results){
        if(err) return res.status(500).json(err);
        res.status(200).json({results:results});
      })
    });
  };

    self.searchMedias = function(query, callback){
      var project = {
        'name' : 1,
        'urlSlug' : 1,
        'logo' : 1,
        'toolId' : 1,
        'uniqueViews' : 1,
        //For Cinema
        'theatreName' : 1,
        'resultMallName' : 1,
        'cinemaChain' : 1,
        'mallName' : 1,
        //For Radio
        'station' : 1,
        'city' : 1,
        'type' : 1,
        //For Newspaper
        'areaCovered' : 1,
        'editionName' : 1
      };
      var match = { searchKeyWords:{ $all:query } };
      Media.aggregate( 
        { $match:match },
        { $project:project },
        { $group:{ _id:'$toolId', medias:{ $push:'$$ROOT' } } },
        function(err, results)
        {
          self.populateMedias(results, callback);
        }
      );
    };

    self.populateMedias = function(tools, callback){
      async.each(tools, function(result, callbackEach){
        Tools.findOne({ _id:result._id },'name').lean().exec(function(err, tool){
          for(i in result['medias'])
          {
            result['medias'][i].toolName = tool.name;
            switch(tool.name)
            {
              case 'cinema':
                if(result['medias'][i].type == 'onScreen')
                {
                  result['medias'][i].name = result['medias'][i].theatreName + ', ' + result['medias'][i].resultMallName;
                  delete result['medias'][i].theatreName;
                  delete result['medias'][i].resultMallName;
                }
                else
                {
                  result['medias'][i].name = result['medias'][i].cinemaChain + ', ' + result['medias'][i].mallName;
                  delete result['medias'][i].mallName;
                }
                delete result['medias'][i].cinemaChain;
                delete result['medias'][i].type;
                break;
              case 'radio':
                result['medias'][i].name = result['medias'][i].station + ', ' + result['medias'][i].city;
                delete result['medias'][i].station;
                delete result['medias'][i].city;
                break;
              case 'newspaper':
                result['medias'][i].name = result['medias'][i].name + ', ' + result['medias'][i].editionName;
                result['medias'][i].name = result['medias'][i].name + ', ' + result['medias'][i].areaCovered;
                delete result['medias'][i].areaCovered;
                delete result['medias'][i].editionName;
                break;
            }
          }
          result['medias'] = self.sortClosestMatch(result['medias']);
          result['medias'] = result['medias'].slice(0, 10);
          callbackEach(err);
        });
      }, function(err){
        tools.sort(function(a,b){ return a.medias.length < b.medias.length });
        var finalResults = [];
        for(i in tools) finalResults = finalResults.concat(tools[i].medias);
        callback(err, self.sortClosestMatch(finalResults));
      });
    };

    self.sortClosestMatch = function(medias){
      var closest = [];
      var others = [];
      for(i in medias)
      {
        if(self.nameQuery.test(medias[i].name)) closest.push(medias[i]);
        else others.push(medias[i]);
      }
      closest.sort(function(a,b){ return parseInt(b.uniqueViews) - parseInt(a.uniqueViews) });
      others.sort(function(a,b){ return parseInt(b.uniqueViews) - parseInt(a.uniqueViews) });
      return [].concat(closest,others);
    };

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