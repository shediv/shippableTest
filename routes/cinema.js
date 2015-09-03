/**
 * Created by goku on 25/08/15.
 */

var express = require('express');
var router = express.Router();
var CinemaCtrl = new (require('../controllers/cinema')).Cinema();

router.get("/", function(req, res){  CinemaCtrl.getCinemas(req, res); });
router.get("/screens", function(req, res){  CinemaCtrl.showCinemas(req, res); });
router.get("/filters", function(req, res){ CinemaCtrl.getFilters(req, res); });
router.get("/upcomingMovies", function(req, res){ CinemaCtrl.upcomingMovies(req, res); });
router.post("/bestRates", function(req, res){ CinemaCtrl.getFilters(req, res); });

module.exports = router;