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

router.get("/:urlSlug", function(req, res){
    Media.findOne({urlSlug: req.params.urlSlug}, function(err, results){
        res.status(200).json({magazines : results});
    });
});

router.get("/create", function(req,res){
    var media = new Media({"name": "India Today"});
    media.save(function(err){
        res.status(200).json(media);
    });
});

module.exports = router;