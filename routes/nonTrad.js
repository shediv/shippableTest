/**
 * Created on 10/09/15.
 */

var express = require('express');
var router = express.Router();
var NonTrad = new (require('../controllers/nonTrad')).NonTrad();

router.get("/", function(req, res){  NonTrad.getNonTrad(req, res); });
router.get("/filters", function(req, res){ NonTrad.getFilters(req, res); });
router.get("/:urlSlug", function(req, res){ NonTrad.show(req, res); });

module.exports = router;