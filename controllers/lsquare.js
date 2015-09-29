var Lsquare = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  
  this.params = {};
  this.toolName = "lsquare";
  var self = this;

  Tools.findOne({name: this.toolName}, function(err, result){
    self.toolId = result._id.toString();
  });

  this.getDigital = function(req, res){
    self.params = JSON.parse(req.query.params);
    res.status(200).json("result");
    async.waterfall([
      function(callback)
      {
        callback(null, self.applyFilters());
      },
      function(query, callback)
      {
        self.sortFilteredMedia(query, callback);
      }
    ],
    function (err, result)
    {
      if(err) return res.status(500).json(err);
      res.status(200).json(result);
    });
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};

      query.projection = {
        '_id' : 1,
        'urlSlug' : 1,
        'name' : 1,
        'answer' : 1,
        'createdBy' : 1
      };

      query.match.isActive = 1;
      //query.match.toolId = self.toolId;
      return query;
    };

    self.sortFilteredMedia = function(query, callback){
      var data = []; 
      async.parallel({
        count : function(callbackInner)
        {          
          Lsquare.aggregate(
            {$match : query.match},
            {$group: { _id : null, count: {$sum: 1} }},
            function(err, result)
            {
              if(result[0] === undefined) count = 0;
              else count = result[0].count;
              callbackInner(err, count);
            }
          );
        },
        questions : function(callbackInner)
        { 
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
            case 'score': query.sortBy = { 'score' : -1}; break;
          }
          query.sortBy._id = 1;
          Media.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            //{$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
               callbackInner(err, results);
            }
          );
        }
      },
      function(err, results) 
      {
        callback(err, results);
      });
    };

  this.getFilters = function(req, res){
    async.parallel({
      categories : self.getTrendingQuestions,
      // mediums : self.getMediums,
      // geoTargets : self.getGeoTargets,
      // pricingModels : self.getPricingModels,
      // languages : self.getLanguages
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getTrendingQuestions = function(callback){
      Lsquare.aggregate(
        {$match: {isActive : 1}},
        {$sort: {"score": -1, "views": -1} }
        {$group : { _id : '$question', count : {$sum : 1}}},
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

  this.addQuestion = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
      if(err) res.status(401).json("Invalid Token");
      else {
        var url = req.body.question;
        // convert spaces to '-'
        url = url.replace(/ /g, "-");
        // Make lowercase
        url = url.toLowerCase();
        // Remove characters that are not alphanumeric or a '-'
        url = url.replace(/[^a-z0-9-]/g, "");
        // Combine multiple dashes (i.e., '---') into one dash '-'.
        url = url.replace(/[-]+/g, "-");
        var question: {
            url: req.body.userId,
            title : req.body.question,
            description : req.body.description,
            title: title
          }
        var newQuestion = Lsquare(question);

        newQuestion.save(function(err){
          if(err) return res.status(500).json(err);
          res.status(200).json({newQuestion:newQuestion._id});
        }

      }
    });
  };

  this.addAnswer = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
      if(err) res.status(401).json("Invalid Token");
      else {
        var answer: {
            url: req.body.userId,
            answer : req.body.answer,
            description : req.body.description,
            id: questionID
          }        

        Lsquare.findOneAndUpdate(query, answer, {upsert:true}, function(err, doc){
          if (err) return res.send(500, { error: err });
          return res.status(200).json("succesfully updated");
        });

      }
    });
  };  

  this.show = function(req, res){
    Lsquare.findOne({urlSlug: req.params.urlSlug}).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      if(!results) return res.status(404).json({error : 'No Such Media Found'});
      res.status(200).json({lsquare : results});
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.connection.remoteAddress,
      urlSlug: req.params.urlSlug,
      type: 'lsquare',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  };

  this.compare = function(req, res){
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    var project = {
      '_id' : 1,
      'urlSlug' : 1,
      'name' : 1,
      'medium' : 1,
      'mediaOptions' : 1,
      'language' : 1,        
      'logo' : 1,
      'geoTagging' : 1,
      'reach1' : 1,
      'reach2' : 1,
      'unit1' : 1,
      'unit2' : 1,
      'categoryId' : 1
    };
    
    Media.find({_id: { $in: ids }}, project).lean().exec(function(err, results){
      if(err) return res.status(500).json(err);
      async.each(results, function(result, callback){
        if(result['reach1'] !== undefined && result['unit1'])
          result['reach1'] = result['reach1'] + ' ' + result['unit1'];
        if(result['reach2'] !== undefined && result['unit2'])
          result['reach2'] = result['reach2'] + ' ' + result['unit2'];
        
        firstmediaOptionsKey = Object.keys(result['mediaOptions'])[0];
        if(result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit1 === undefined){ minimumQtyUnit1 = false;} else { minimumQtyUnit1 = result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit1; }
        if(result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit2 === undefined){ minimumQtyUnit2 = false;} else { minimumQtyUnit2 = result.mediaOptions[firstmediaOptionsKey].minimumQtyUnit2; }
        if(result.mediaOptions[firstmediaOptionsKey].pricingUnit1 === undefined){ pricingUnit1 = false;} else { pricingUnit1 = result.mediaOptions[firstmediaOptionsKey].pricingUnit1; }
        if(result.mediaOptions[firstmediaOptionsKey].pricingUnit2 === undefined){ pricingUnit2 = false;} else { pricingUnit2 = result.mediaOptions[firstmediaOptionsKey].pricingUnit2; }                                      
        
        if(minimumQtyUnit2)
        {
          minimumUnit = minimumQtyUnit1 + ' ' + pricingUnit1 + ' / ' + minimumQtyUnit2 + ' ' + pricingUnit2;
          minimumBilling = (result.mediaOptions[firstmediaOptionsKey].cardRate * minimumQtyUnit1 * minimumQtyUnit2);
        }
        else
        {
          minimumUnit =  minimumQtyUnit1 + ' ' +  pricingUnit1;
          minimumBilling =  result.mediaOptions[firstmediaOptionsKey].cardRate *  minimumQtyUnit1;
        }
        result['minimumBilling'] = minimumBilling;
        Category.findOne({ _id:result.categoryId },'name').lean().exec(function(err, cat){
          if(cat) result.categoryName = cat.name;
          callback(err);
        });
      }, function(err){
        res.status(200).json({medias:results});  
      });
    });
  };
};

module.exports.Lsquare = Lsquare;