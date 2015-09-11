/**
 * Created on 10/09/15.
 */

var express = require('express');
var router = express.Router();
var NonTraditional = new (require('../controllers/nonTraditional')).NonTraditional();

router.get("/", NonTraditional.getNonTraditional);
router.get("/filters", NonTraditional.getFilters);
router.get("/subCategories", NonTraditional.getSubCategories);
router.get("/:urlSlug", NonTraditional.show);

module.exports = router;