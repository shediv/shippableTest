/**
 * Created by videsh on 08/09/15.
 */

var express = require('express');
var router = express.Router();
var InflightCtrl = new (require('../controllers/inflight')).Inflight();

router.get("/", function(req, res){  InflightCtrl.getInflight(req, res); });
router.get("/filters", function(req, res){ InflightCtrl.getFilters(req, res); });
router.post("/bestRates", function(req, res){ InflightCtrl.getBestRates(req, res); });
// router.get("/compare", function(req, res){ InflightCtrl.compare(req, res); });
// router.get("/related", function(req, res){ InflightCtrl.relatedMedia(req, res) });
router.get("/:urlSlug", function(req, res){ InflightCtrl.show(req, res); });

module.exports = router;