/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var MagCtrl = new (require('../controllers/magazine')).Mag();

router.get("/", function(req, res){MagCtrl.getMagazines(req, res);});
router.get("/getFilters", function(req, res){ MagCtrl.getFilters(req, res); });
router.get("/compare", function(req, res){ MagCtrl.compare(req, res); });
router.get("/related/:categoryId", function(req, res){ MagCtrl.relatedMedia(req, res) });
router.get("/:urlSlug", function(req, res){ MagCtrl.show(req, res); });

module.exports = router;