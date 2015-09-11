/**
 * Created on 10/09/15.
 */

var express = require('express');
var router = express.Router();
var NonTraditional = new (require('../controllers/nonTraditional')).NonTraditional();

router.get("/", function(req, res){  NonTraditional.getNonTraditional(req, res); });
router.get("/filters", function(req, res){ NonTraditional.getFilters(req, res); });
router.get("/subCategories", function(req, res){ NonTraditional.getSubCategories(req, res); });
router.get("/:urlSlug", function(req, res){ NonTraditional.show(req, res); });

module.exports = router;