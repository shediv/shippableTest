/**
 * Created on 17/09/15.
 */

var express = require('express');
var router = express.Router();
var Cafe = new (require('../controllers/cafe')).Cafe();

router.get("/", Cafe.getCafe);
router.post("/store", Cafe.store);
router.get("/filters", Cafe.getFilters);
router.post("/update", Cafe.update);
router.get("/:urlSlug", Cafe.show);

module.exports = router;