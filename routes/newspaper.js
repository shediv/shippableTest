/**
 * Created by videsh on 31/08/15.
 */

var express = require('express');
var router = express.Router();
var NewspaperCtrl = new (require('../controllers/newspaper')).Newspaper();

router.get("/", function(req, res){  NewspaperCtrl.getRadios(req, res); });
router.get("/filters", function(req, res){ NewspaperCtrl.getFilters(req, res); });
router.post("/bestRates", function(req, res){ NewspaperCtrl.getBestRates(req, res); });
router.get("/compare", function(req, res){ NewspaperCtrl.compare(req, res); });
router.get("/related", function(req, res){ NewspaperCtrl.relatedMedia(req, res) });
router.get("/:urlSlug", function(req, res){ NewspaperCtrl.show(req, res); });

module.exports = router;