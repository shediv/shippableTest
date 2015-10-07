/**
 * Created by videsh on 14/09/15.
 */

var express = require('express');
var router = express.Router();
var DigitalCtrl = new (require('../controllers/digital')).Digital();

router.get("/", DigitalCtrl.getDigital);
router.get("/filters", DigitalCtrl.getFilters);
router.get("/compare", DigitalCtrl.compare);
router.get("/:urlSlug", DigitalCtrl.show);

module.exports = router;