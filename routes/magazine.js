/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var Media = require('../models/media').Media;

router.get("/", function(req, res){
    Media.find({}, function(err, results){
        res.status(200).json({magazines : results});
    });
});


/**
Search for a Magazine based on the urlSlug
// API link : magazine/sony

Input : urlSlug
Output : Details of a Magazine
**/
router.get("/:urlSlug", function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}, function(err, results){
        res.status(200).json({magazines : results});
    });
});



/**
 Find related Media based on Category and urlSlug provided
// API link : magazine/related/5587d7a25430e3deea5e80ff?urlSlug=media13

Input : categoryId and urlSlug
Output : List of related Magazine
**/
router.get("/related/:categoryId", function(req, res){
    //Query for maxReadership, maxNoOfPages, minFullPage
    Media.aggregate(
        { $match : { categoryId : req.params.categoryId, 
                     toolId : "5575381acffc83080bb594f0", 
                     isActive: 1  } },
        { $group: { _id: "$categoryId", 
                    maxReadership: { $max: "$attributes.readership.value" }, 
                    maxNoOfPages: { $max: "$attributes.noOfPages.value" }, 
                    minFullPage: { $min: "$mediaOptions.print.fullPage.1-2" } } }, 
        function(err, results){

                    // Assign maxReadership, maxNoOfPages, minFullPage
                    var maxReadership = results[0].maxReadership;
                    var maxNoOfPages = results[0].maxNoOfPages;
                    var minFullPage = results[0].minFullPage;
                   
                   //All the match conditions for related Media
                    var match = {
                            "$match" : {
                                "categoryId" : req.params.categoryId,
                                "toolId" : "5575381acffc83080bb594f0",
                                "isActive": 1,
                                "urlSlug" : { $ne : req.query.urlSlug}    
                            }
                        };

                   //All the project conditions for related Media     
                   var project1 = {
                        "$project" : {
                        "urlSlug" : 1,
                        "thumbnail" : 1,
                        "attributes" : 1,
                        // Y formulae calculation                              
                        "yValue" : {
                                "$add" : [
                                            {        
                                            "$multiply" : [
                                                {
                                                    "$divide" : [
                                                        {
                                                            "$multiply" : [
                                                                "$attributes.noOfPages.value",
                                                                10
                                                            ]
                                                        },
                                                        maxNoOfPages
                                                    ]
                                                },
                                                0.6
                                                ]
                                            },

                                            {        
                                            "$multiply" : [
                                                {
                                                    "$divide" : [
                                                        {
                                                            "$multiply" : [
                                                                "$attributes.readership.value",
                                                                10
                                                            ]
                                                        },
                                                        maxReadership
                                                    ]
                                                },
                                                0.3
                                                ]
                                            },

                                            {        
                                            "$multiply" : [
                                                {
                                                    "$divide" : [
                                                        {
                                                            "$multiply" : [
                                                                "$mediaOptions.print.fullPage.1-2",
                                                                10
                                                            ]
                                                        },
                                                        minFullPage
                                                    ]
                                                },
                                                0.1
                                                ]
                                            }
                                            ]
                                }                                    
                        }
                    };

                   //All the sort conditions for related Media 
                    var sort = {
                        "$sort" : { yValue : -1}
                    };

                   //All the limit conditions for related Media 
                    var limit = {
                        "$limit" : 3
                    };                                                

                // Main Query to find related Media based on Category and urlSlug provided    
                Media.aggregate(
                        [match, project1, sort, limit],
                            function(err, results){
                                res.status(200).json(results);
                        });                                                        

    });

});


router.get("/create", function(req,res){
    var media = new Media({"name": "India Today"});
    media.save(function(err){
        res.status(200).json(media);
    });
});

module.exports = router;