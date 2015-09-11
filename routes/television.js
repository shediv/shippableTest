/**
 * Created by videsh on 11/09/15.
 */

var express = require('express');
var router = express.Router();
var TelevisionCtrl = new (require('../controllers/television')).Television();

router.get("/", TelevisionCtrl.getTelevision);
router.get("/filters", TelevisionCtrl.getFilters);
router.get("/compare", TelevisionCtrl.compare);
router.get("/:urlSlug", TelevisionCtrl.show);

module.exports = router;