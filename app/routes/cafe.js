/**
 * Created on 17/09/15.
 */

var express = require('express');
var router = express.Router();
var Cafe = new (require('../controllers/cafe')).Cafe();

router.get("/", Cafe.getCafe);
router.post("/cafe", Cafe.store);
router.get("/filters", Cafe.getFilters);
router.post("/update", Cafe.update);
router.get("/search", Cafe.search);
router.get("/trending", Cafe.trending);
router.get("/:urlSlug", Cafe.show);

module.exports = router;