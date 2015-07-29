/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var Media = require('../models/media').Media;

router.get("/", function(req, res){
    Media.find({}, function(err, results){
        var test = findDocs();
        res.status(200).json({magazines : test});
    });
});

function findDocs(){
    console.log("find docs called");
    Media.find({}, function(err, results){
        console.log(results);
        return results;
    });
};

/**
 Compare Magazines based on the ID's
 // API link : /magazine/compare

 Input : List of magazine's ID's
 Output : Details of a Magazine
 **/
router.get("/compare", function(req, res){
    var ID = JSON.parse(req.query.params);
    console.log(ID);

    Media.find({_id: { $in: ID }}, function(err, results){
        //res.status(200).json(results);
        var data = {};
        for(key in results) {
            var tmp = [];
            tmp['_id'] = results[key].urlSlug;
            tmp['name'] = results[key].name;

            //data = tmp.slice();;
            //console.log(tmp);
            //document.write(results[key]);
            res.status(200).json(tmp);
        }

        //res.status(200).json(results[key]);

        //res.status(200).json(data);

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
        res.status(200).json({magazine : results});
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
        {
            $match : {
                categoryId : req.params.categoryId,
                toolId : "5575381acffc83080bb594f0",
                isActive: 1
            }
        },
        {
            $group: {
                _id: "$categoryId",
                maxReadership: { $max: "$attributes.readership.value" },
                maxNoOfPages: { $max: "$attributes.noOfPages.value" },
                minFullPage: { $min: "$mediaOptions.print.fullPage.1-2" }
            }
        }, function(err, results){

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
            var project = {
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
            Media.aggregate([match, project, sort, limit], function(err, results){
                res.status(200).json(results);
            });
        }
    );
});


module.exports = router;