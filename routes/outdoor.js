/**
 * Created by videsh on 10/09/15.
 */

var express = require('express');
var router = express.Router();
var OutdoorCtrl = new (require('../controllers/outdoor')).Outdoor();

router.get("/", OutdoorCtrl.getOutdoor);
router.get("/filters", OutdoorCtrl.getFilters);
router.get("/:urlSlug", OutdoorCtrl.show);

module.exports = router;