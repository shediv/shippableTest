var Geography = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Geography = require('../models/geography').Geography;

  this.params = {};
  var self = this;

  this.store = function(req, res){
    // create a new Media
    var newGeography = Geography(req.body);

    // save the Media
    newGeography.save(function(err) {
      if(err) return res.status(500).json(err);
      res.status(200).json(newGeography);
    });
  };

  this.search = function(req, res){
    var qString = req.query.q;
    async.parallel({
      states : function(callback){ self.searchByKey('state', qString, callback); },
      cities : function(callback){ self.searchByKey('city', qString, callback); },
      localities : function(callback){ self.searchByKey('locality', qString, callback); }
    },
    function(err, results){
      if(err) return res.status(500).json(err);
      var geographies = [];
      geographies = geographies.concat(results.states, results.cities, results.localities);
      res.status(200).json({geographies:geographies});
    });
  };

    self.searchByKey = function(key, qString, callback){
      var qRegExp = new RegExp('\\b'+qString, "i");
      var match = {}; match[key] = qRegExp;
      Geography.distinct(key, match, function(err, results){
        results.sort();
        results = results.slice(0, 5);
        var geographies = [];
        switch(key)
        {
          case 'state': 
            for(i in results)
            {
              var geo = {}
              geo.state = results[i];
              geo.place = key;
              geographies.push(geo);
            }   
            callback(err, geographies); 
            break;
          case 'city':
            async.each(results, function(result, callbackInner){
              Geography.findOne({city:result,state:{$exists:1}}).lean().exec(function(err, result){
                var geo = {}
                geo.state = result.state;
                geo.city = result.city;
                geo.place = key;
                geographies.push(geo);
                callbackInner();
              });
            },function(err){
              if(err) throw err;
              callback(err, geographies);
            });
            break;
          case 'locality':
            async.each(results, function(result, callbackInner){
              Geography.find({locality:result,state:{$exists:1},city:{$exists:1}}).lean().exec(function(err, results){
                results.map(function(result){
                  var geo = {}
                  geo.state = result.state;
                  geo.city = result.city;
                  geo.locality = result.locality;
                  geo.place = key;
                  geographies.push(geo);
                })
                callbackInner();
              });
            },function(err){
              if(err) throw err;
              callback(err, geographies);
            });
            break;
        }
      });
    }
}    

module.exports.Geo = Geography;