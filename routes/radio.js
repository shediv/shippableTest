/**
 * Created by videsh on 31/08/15.
 */

var express = require('express');
var router = express.Router();
var RadioCtrl = new (require('../controllers/radio')).Radio();

router.get("/", RadioCtrl.getRadios);
router.get("/filters", RadioCtrl.getFilters);
router.post("/bestRates", RadioCtrl.getBestRates);
router.get("/compare", RadioCtrl.compare);
router.get("/related", RadioCtrl.relatedMedia);
router.get("/:urlSlug", RadioCtrl.show);

module.exports = router;