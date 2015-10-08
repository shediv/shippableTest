/**
 * Created on 17/09/15.
 */

var express = require('express');
var router = express.Router();
var _12thCross = new (require('../controllers/12thCross'))._12thCross();

router.get("/", _12thCross.get12thCross);
router.post("/store", _12thCross.store);
router.post("/contact", _12thCross.contact);
router.get("/filters", _12thCross.getFilters);
router.get("/getVendors", _12thCross.getVendors);
router.post("/updateVendor", _12thCross.updateVendor);
router.get("/:urlSlug", _12thCross.show);

module.exports = router;