/**
 * Created by videsh on 10/09/15.
 */

var express = require('express');
var router = express.Router();
var OutdoorCtrl = new (require('../controllers/outdoor')).Outdoor();

router.get("/", function(req, res){  OutdoorCtrl.getOutdoor(req, res); });
router.get("/filters", function(req, res){ OutdoorCtrl.getFilters(req, res); });
router.post("/bestRates", function(req, res){ OutdoorCtrl.getBestRates(req, res); });
// router.get("/compare", function(req, res){ InflightCtrl.compare(req, res); });
// router.get("/related", function(req, res){ InflightCtrl.relatedMedia(req, res) });
router.get("/:urlSlug", function(req, res){ OutdoorCtrl.show(req, res); });

module.exports = router;