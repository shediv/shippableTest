var _12thCross = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var TwelthCross = require('../models/12thCross').TwelthCross;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;
  var SubCategory = require('../models/subCategory').SubCategory;
  var Contact = require('../models/contact').Contact;
  var nodeMailer = require('nodemailer');
  var jwt = require('jsonwebtoken');
  this.params = {};
  this.config = require('../config.js');
  var self = this;

  this.transporter = nodeMailer.createTransport({
    service: self.config.smtpService,
    host: self.config.smtpHost,
    port: self.config.smtpPort,
    auth: self.config.smtpAuth
  });

  var path = require('path');
  var EmailTemplate = require('email-templates').EmailTemplate;
  var templatesDir = path.resolve(__dirname, '..', 'public/templates/emailTemplates');
  
  this.params = {};
  var self = this;

  this.store = function(req, res){
    // create a new Media
    var newAgency = TwelthCross(req.body);

    // save the Media
    newAgency.save(function(err) {
      if(err) return res.status(500).json(err);
      res.status(200).json("Agency Created Successfully");
    });
  };
  
  this.get12thCross = function(req, res){
    self.params = JSON.parse(req.query.params);
    async.waterfall([
      function( callback)
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

  //Get all the vendors from 12th cross
  self.getVendors = function(req, res){
    TwelthCross.find(
      {isActive:1}, {urlSlug: 'urlSlug', name: 'name'},     
      function(err, results) 
      {
        if(err) return res.status(500).json(err);
        return res.status(200).json({vendors:results});        
      }
    );
  };

  //update a vendor based on ID in 12th Cross
  self.updateVendor = function(req, res){
    var vendorID = req.body.vendor._id;
    var vendorData = req.body.vendor;
    TwelthCross.findOneAndUpdate({_id : vendorID}, vendorData, {upsert:true}, function(err, doc){
      if(err) return res.status(500).json(err);
      return res.send("Vendor info succesfully updated");
    });
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'views';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};
      query.projection = {
        '_id'          : 1,
        'name'         : 1,
        'subCategoryId': 1,
        'geography'    : 1,
        'urlSlug'      : 1,
        'logo'         : 1
      };
      
      if(self.params.filters.geographies.length) query.match['geography'] = { $in:self.params.filters.geographies };
      if(self.params.filters.subCategories.length) query.match['subCategoryId'] = { $in:self.params.filters.subCategories };
      query.match.isActive = 1;
      
      return query;
    };

    self.sortFilteredMedia = function(query, callback){ 
      async.parallel({
        count : function(callbackInner)
        {          
          TwelthCross.aggregate(
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
        vendors : function(callbackInner)
        {
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;
          }
          query.sortBy._id = 1;
          TwelthCross.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {
              async.each(results, function(result,callbackEach){
                async.parallel({
                  subCategories: function(callbackParallel){
                    SubCategory.find({ _id:{ $in:result.subCategoryId } },'name').lean().exec(function(err, subCats){
                      if(subCats)
                      {
                        result.subCategories = [];
                        for(i in subCats) result.subCategories.push(subCats[i].name);
                      }
                      callbackParallel(err, null);
                    })
                  },
                  geography: function(callbackParallel){
                    Geography.findOne({ _id:result.geography }).lean().exec(function(err, geo){
                      if(geo) result.geography = geo;
                      callbackParallel(err, null);
                    })
                  }
                },function(err, res){
                  callbackEach(err);
                });
              }, function(err){
                callbackInner(err,results);
              });
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
      servicesProvided : self.getCategories,
      geographies : self.getGeographies
    },                                                                                      
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getCategories = function(callback){
      async.parallel({
        categories: function(callbackInner){
          TwelthCross.aggregate(
            { $match:{ isActive:1 } }, 
            { $unwind:'$categoryId' },
            { $project:{ categoryId:1 } },
            function(error, results)
            {
              var categoryIds = [];
              for(i in results) categoryIds = categoryIds.concat(results[i].categoryId);
              Category.find({_id : {$in: categoryIds}},'name').lean().exec(function(err, cats){
                callbackInner(err, cats);
              });
            }
          );
        },
        subCategories: function(callbackInner){
          TwelthCross.aggregate(
            { $match:{ isActive:1 } }, 
            { $unwind:'$subCategoryId' },
            { $project:{ subCategoryId:1 } },
            function(error, results)
            {
              var subCategoryIds = [];
              for(i in results) subCategoryIds = subCategoryIds.concat(results[i].subCategoryId);
              SubCategory.find({ _id:{ $in:subCategoryIds } }).lean().exec(function(err, result){
                var subObj = {};
                for(i in result)
                {
                  if(!subObj[result[i].categoryId]) subObj[result[i].categoryId] = [];
                  subObj[result[i].categoryId].push(result[i]);
                }
                callbackInner(err, subObj);
              });
            }
          );
        }
      }, 
      function(err, result)
      {
        for(i in result.categories)
          result.categories[i].subCategories = result.subCategories[result.categories[i]._id];
        callback(err, result.categories);
      });
    };

    self.getGeographies = function(callback){
      TwelthCross.distinct('geography',
        { toolId:self.toolId , isActive:1 },
        function(err, geographyIds) 
        {
          Geography.find({_id : {$in: geographyIds}},'city').lean().exec(function(err, geos){
            callback(err, geos);
          });
        }
      );
    };

  this.show = function(req, res){
    TwelthCross.findOne({urlSlug: req.params.urlSlug}).lean().exec(
      function(err, result)
      {
        if(!result) res.status(404).json({error : 'No Such Media Found'});
        async.parallel({
          categories: function(callback){
            Category.find({ _id:{ $in:result.categoryId } },'name').lean().exec(function(err, cats){
              if(cats)
              {
                result.categories = [];
                for(i in cats) result.categories.push(cats[i].name);
              }
              callback(err, null);
            })
          },
          subCategories: function(callback){
            SubCategory.find({ _id:{ $in:result.subCategoryId } },'name').lean().exec(function(err, subCats){
              if(subCats)
              {
                result.subCategories = [];
                for(i in subCats) result.subCategories.push(subCats[i].name);
              }
              callback(err, null);
            })
          },
          geography: function(callback){
            Geography.findOne({ _id:result.geography }).lean().exec(function(err, geo){
              if(geo) result.geography = geo;
              callback(err, null);
            })
          },
          areaOfServices: function(callback){
            //console.log(result.areaOfServices);
            if(result.areaOfServices !== undefined)
            {
              Geography.find({ _id:{ $in:result.areaOfServices } }).lean().exec(function(err, geo){
                if(geo) result.areaOfServices = geo;
                callback(err, null);
              })
            }
            else callback(err, null);
          }
        },function(err, results){          
          var metaTags = {
            name : result.name,
            image  : result.imageUrl,
            description  : result.description,
            facebook : self.config.facebook,
            twitter : self.config.twitter
          }
          res.status(200).json({vendor : result, metaTags : metaTags});
        })
      }
    );
    
    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.connection.remoteAddress,
      urlSlug: req.params.urlSlug,
      type: '12thcross'
    };
    CommonLib.uniqueVisits(visitor);
  };

  //Contact mail to be sent to agencies
  self.contact = function(req, res){     
    var emailTo;
    var mailOptions = {};
    mailOptions.to = req.body.to;
    mailOptions.message = req.body.message;
    mailOptions.toolName =  '12thcross';
    mailOptions.appHost = self.config.appHost;
    var newContact = Contact(mailOptions);

    if(mailOptions.to.email){ emailTo = mailOptions.to.email;} else { emailTo = mailOptions.to.others[0].email;} 
            
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if(!token) return res.status(401).json("Token not found"); 
    jwt.verify(token, self.config.secret, function(err, decoded){

      var firstName = decoded.firstName;
      firstName = firstName.substring(0,1).toUpperCase() + firstName.substring(1);
      mailOptions.name = firstName;
      if(err) res.status(401).json("Invalid Token");
        // save the Contact mail
        newContact.save(function(err){      
          if(err) return res.status(500).json(err);          
          var emailTemplate = new EmailTemplate(path.join(templatesDir, 'contact'));
          emailTemplate.render(mailOptions, function(err, results){            
            if(err) return console.error(err)
            self.transporter.sendMail({
              from: decoded.email, // sender address
              to: emailTo, // list of receivers
              //cc: decoded.email,
              subject: 'Contacting for your service.',
              html: results.html
            }, function(err, responseStatus){
              if(err) return console.error(err);
               return res.status(200).json("sucess");
            })
          });

        });        
    });
  };    

};

module.exports._12thCross = _12thCross;