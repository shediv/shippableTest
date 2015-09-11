/**
 * Created by goku on 25/08/15.
 */

var express = require('express');
var router = express.Router();
var CinemaCtrl = new (require('../controllers/cinema')).Cinema();

router.get("/", CinemaCtrl.getCinemas);
router.get("/screens", CinemaCtrl.showCinemas);
router.get("/filters", CinemaCtrl.getFilters);
router.get("/upcomingMovies", CinemaCtrl.upcomingMovies);
router.post("/bestRates", CinemaCtrl.getFilters);

module.exports = router;