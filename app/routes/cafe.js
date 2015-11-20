/**
 * Created on 17/09/15.
 */

var express = require('express');
var router = express.Router();
var Cafe = new (require('../controllers/cafe')).Cafe();

router.get("/", Cafe.getCafe);
router.post("/", Cafe.store);
router.get("/filters", Cafe.getFilters);
router.put("/update", Cafe.update);
router.post("/createPost", Cafe.createPost);
router.get("/search", Cafe.search);
router.get("/allTopics", Cafe.allTopics);
router.get("/topContributors", Cafe.topContributors);
router.get("/trending", Cafe.trending);
router.get("/:Id", Cafe.show);

module.exports = router;