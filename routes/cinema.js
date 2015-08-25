/**
 * Created by goku on 25/08/15.
 */

var express = require('express');
var router = express.Router();
var CinemaCtrl = new (require('../controllers/cinema')).Cinema();

router.get("/", function(req, res){  CinemaCtrl.getCinemas(req, res); });
router.get("/getFilters", function(req, res){ CinemaCtrl.getFilters(req, res); });
router.get("/getBestRates", function(req, res){ CinemaCtrl.getFilters(req, res); });

module.exports = router;