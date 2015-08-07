var Media = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var Tools = require('../models/tool').Tools;
  var Products = require('../models/product').Products;
  var Geography = require('../models/geography').Geography;
  var Category = require('../models/category').Category;

  var underscore = require("underscore");

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

    scope.underscore = function(req, res){
        //res.status(200).json(underscore.difference([1, 2, 3, 4, 5], [5, 2, 10]));
        var medias = [];
        var keyword = ["student"];

        var magazines2 = [
                          {
                            _id: "55b7e3508ead0e48288b48fd",
                            toolId: "55755d6c66579f76671b1a1d",
                            categoryId: "55b774b28ead0e0a048b4580",
                            name: "Asia Pacific Boating India Magazine",
                            urlSlug: "asia-pacific-boating-india-magazine-advertising",
                            attributes: {
                            language: {
                            value: "English"
                            },
                            frequency: {
                            value: "Bi-Monthly"
                            },
                            circulation: {
                            value: 25000
                            },
                            readership: {
                            value: 125000
                            },
                            coverPrice: {
                            value: "N/A"
                            }
                            },
                            createdBy: 1,
                            thumbnail: "/images/medias/55b7e3508ead0e48288b48fd/55b7e3508ead0e48288b48fd_thumbnail.jpg"
                          }
                        ];

          var magazines = [
                            {
                              _id: "55b7e3508ead0e48288b48fd",
                              toolId: "55755d6c66579f76671b1a1d",
                              categoryId: "55b774b28ead0e0a048b4580",
                              name: "Asia Pacific Boating India Magazine",
                              urlSlug: "asia-pacific-boating-india-magazine-advertising",
                              attributes: {
                              language: {
                              value: "English"
                              },
                              frequency: {
                              value: "Bi-Monthly"
                              },
                              circulation: {
                              value: 25000
                              },
                              readership: {
                              value: 125000
                              },
                              coverPrice: {
                              value: "N/A"
                              }
                              },
                              keywords: ["walk"],
                              createdBy: 1,
                              thumbnail: "/images/medias/55b7e3508ead0e48288b48fd/55b7e3508ead0e48288b48fd_thumbnail.jpg"
                            },
                            {
                              _id: "55b7e3508ead0e48288b48f9",
                              toolId: "55755d6c66579f76671b1a1d",
                              categoryId: "55b776668ead0e3b068b458e",
                              name: "Divya Himgiri Magazine",
                              urlSlug: "divya-himgiri-magazine-advertising",
                              attributes: {
                              language: {
                              value: "Hindi"
                              },
                              frequency: {
                              value: "Weekly"
                              },
                              circulation: {
                              value: 0
                              },
                              readership: {
                              value: 0
                              },
                              coverPrice: {
                              value: "N/A"
                              }
                              },
                              keywords: ["walk", "student"],
                              createdBy: 1,
                              thumbnail: "/images/medias/55b7e3508ead0e48288b48f9/55b7e3508ead0e48288b48f9_thumbnail.jpg"
                            },
                            {
                              _id: "55b7e3508ead0e48288b48f6",
                              toolId: "55755d6c66579f76671b1a1d",
                              categoryId: "55b776378ead0e3b068b4578",
                              name: "Champak Magazine - Marathi Edition",
                              urlSlug: "champak-magazine-marathi-edition-advertising",
                              attributes: {
                              language: {
                              value: "Marathi"
                              },
                              frequency: {
                              value: "Monthly"
                              },
                              circulation: {
                              value: 38000
                              },
                              readership: {
                              value: 304000
                              },
                              coverPrice: {
                              value: "N/A"
                              }
                              },
                              keywords: ["walk"],
                              createdBy: 1,
                              thumbnail: "/images/medias/55b7e3508ead0e48288b48f6/55b7e3508ead0e48288b48f6_thumbnail.jpg"
                            }
                          ];

        magazines  = underscore.toArray(magazines);

       // $result=array_intersect($keywords,$tmp['keywords']);
       

        for(var i= 0; i < magazines.length; i++){
            //console.log(result.medias[i].keywords);}
            var check = underscore.intersection(magazines[i].keywords, keyword);            
            if(check.length > 0){
              medias.push(magazines[i]);
            } 
        }                                                  

        //res.status(200).json(magazines);
        res.status(200).json(medias);
        //res.status(200).json(underscore.intersection(magazines, magazines2));                        
    };    

}    


module.exports.Med = Media;