/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var Media = require('../models/media').Media;
var Category = require('../models/category').Category;
var MagCtrl = new (require('../controllers/magazine')).Mag();

//API :- http://localhost:3000/magazine?params=%7B%22offset%22:0,%22limit%22:9,%22filters%22:%7B%22categories%22:%5B%5D,%22geography%22:%5B%5D,%22languages%22:%5B%5D,%22frequencies%22:%5B%5D,%22targetGroups%22:%5B%5D,%22mediaOptions%22:%5B%5D%7D,%22sortBy%22:%22views%22,%22tmaRecommended%22:false%7D
router.get("/", function(req, res){  MagCtrl.getMagazines(req, res); });

//API :- http://localhost:3000/magazine/getFilters
router.get("/getFilters", function(req, res){ MagCtrl.getFilters(req, res); });

//API link : magazine/compare?params=%5B"55b7e3508ead0e48288b48fd","55b7e3508ead0e48288b48f9","55b7e3508ead0e48288b48f6"%5D
router.get("/compare", function(req, res){ MagCtrl.compare(req, res); });

//API link : magazine/related/55b776838ead0e3b068b45a2?urlSlug=fhm-magazine-advertising
router.get("/related/:categoryId", function(req, res){ MagCtrl.relatedMedia(req, res) });

//API link : magazine/fhm-magazine-advertising
router.get("/:urlSlug", function(req, res){ MagCtrl.show(req, res); });

module.exports = router;