/**
 * Created by goku on 25/08/15.
 */

var express = require('express');
var router = express.Router();
var CinemaCtrl = new (require('../controllers/cinema')).Cinema();

router.get("/", function(req, res){  CinemaCtrl.getCinemas(req, res); });
router.get("/filters", function(req, res){ CinemaCtrl.getFilters(req, res); });
router.get("/getBestRates", function(req, res){ CinemaCtrl.getFilters(req, res); });
router.get("/allScreen",function(req, res){ CinemaCtrl.allScreen(req, res); });

module.exports = router;