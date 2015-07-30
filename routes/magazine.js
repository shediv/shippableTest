/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var Media = require('../models/media').Media;

var Product = require('../models/product').Product;
var Category = require('../models/media').Category;
var functions = require('../functions/magazine');
var async = require('async');
var params;
var query = {};

router.get("/", function(req, res){
    params = JSON.parse(req.query.params);
    if(params.tmaRecommended){
        res.status(200).json("tma recommended");
        //call tmaRecommended function
    } else {
        async.series({
            setToolId: function(callback){
                functions.getToolId("magazine", true, function(err, results){
                    callback(err);
                });
            },
            buildQuery: function(callback){
                functions.buildQuery(params, function(err, results){
                    callback(err);
                });
            },
            magazines: function(callback){
                if(params.sortBy == 'top3'){
                    functions.top3(function(err, results){
                        callback(err, results);
                    });
                } else {
                    functions.search(function(err, results){
                        callback(err, results);
                    });
                }
            }
        }, function (err, result) {
            res.status(200).json(result);
        });
    }
});
>>>>>>> e5f344a8b9a0f544fa1c8f119f9054533b4bddd5

router.get("/getFilters", function(req, res){
    async.series({
        toolId : function(callback){
            functions.getToolId("magazine", true, function(err, results){
                callback(err);
            });
        },
        filters:function(callback){
            async.parallel({
                categories: functions.getCategories,
                geography : functions.getGeographies,
                languages : functions.getLanguages,
                targetGroups : functions.getTargetGroups,
                frequencies : functions.getFrequencies,
                mediaOptions: functions.getMediaOptions,
                products : functions.getProducts
            }, function(err, results){
                callback(err, results);
            });
        }
    }, function(err, result){
        res.status(200).json(result);
    });
});

/**
Compare Magazines based on the ID's
// API link : /magazine/compare?params=%5B"558a47f675d5fdf3118b4567","5593876575d5fde7058b4568","558a47de75d5fdf2118b4567"%5D

Input : List of magazine's ID's
Output : Details of a Magazine with category names
**/
router.get('/compare', function(req, res, next) {
    var ids = JSON.parse(req.query.params);
    var catIds = [];
    async.series({
        medias : function(callback){
            Media.find({_id: { $in: ids }}, function(err, results){
                var medias = results.map(function(m){
                    catIds.push(m.categoryId);
                    return m.toObject();
                });
                callback(err, medias);
            });
        },
        categories : function(callback){
            Category.find({_id : {$in : catIds}}, function(err, results){
                var categoryNames = {};
                for(var i= 0; i < results.length; i++){
                    categoryNames[results[i]._id] = results[i].name;
                }
                callback(err, categoryNames);
            });
        }
    }, function(err, result){
        for(var i =0; i < result.medias.length; i++) {
            result.medias[i].categoryName = result.categories[result.medias[i].categoryId];            
        }
        res.status(200).json(result);
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

/**
 * Search for a Magazine based on the urlSlug
 * API link : magazine/sony
 * Input : urlSlug
 * Output : Details of a Magazine
 **/
router.get("/:urlSlug", function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}, function(err, results){
        res.status(200).json({magazine : results});
    });
});

module.exports = router;