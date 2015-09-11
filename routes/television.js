/**
 * Created by videsh on 11/09/15.
 */

var express = require('express');
var router = express.Router();
var TelevisionCtrl = new (require('../controllers/television')).Television();

router.get("/", function(req, res){  TelevisionCtrl.getTelevision(req, res); });
router.get("/filters", function(req, res){ TelevisionCtrl.getFilters(req, res); });
router.post("/bestRates", function(req, res){ TelevisionCtrl.getBestRates(req, res); });
// router.get("/compare", function(req, res){ InflightCtrl.compare(req, res); });
// router.get("/related", function(req, res){ InflightCtrl.relatedMedia(req, res) });
router.get("/:urlSlug", function(req, res){ TelevisionCtrl.show(req, res); });

module.exports = router;