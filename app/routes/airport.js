/**
 * Created by videsh on 08/09/15.
 */

var express = require('express');
var router = express.Router();
var AirportCtrl = new (require('../controllers/airport')).Airport();

router.get("/", AirportCtrl.getAirport);
router.get("/filters", AirportCtrl.getFilters);
router.get("/compare", AirportCtrl.compare);
router.get("/:urlSlug", AirportCtrl.show);

module.exports = router;