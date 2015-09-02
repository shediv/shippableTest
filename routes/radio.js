/**
 * Created by videsh on 31/08/15.
 */

var express = require('express');
var router = express.Router();
var RadioCtrl = new (require('../controllers/radio')).Radio();

router.get("/", function(req, res){  RadioCtrl.getRadios(req, res); });
router.get("/filters", function(req, res){ RadioCtrl.getFilters(req, res); });
router.post("/bestRates", function(req, res){ RadioCtrl.getBestRates(req, res); });
router.get("/compare", function(req, res){ RadioCtrl.compare(req, res); });
router.get("/related/:city", function(req, res){ RadioCtrl.relatedMedia(req, res) });
router.get("/mail", function(req, res){ RadioCtrl.mail(req, res); });
router.get("/:urlSlug", function(req, res){ RadioCtrl.show(req, res); });

module.exports = router;