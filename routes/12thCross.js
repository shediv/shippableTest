/**
 * Created on 17/09/15.
 */

var express = require('express');
var router = express.Router();
var _12thCross = new (require('../controllers/12thCross'))._12thCross();

router.get("/", _12thCross.get12thCross);
router.get("/filters", _12thCross.getFilters);
router.get("/:urlSlug", _12thCross.show);

module.exports = router;