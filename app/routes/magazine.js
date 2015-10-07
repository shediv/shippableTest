/**
 * Created by srujan on 20/01/15.
 */

var express = require('express');
var router = express.Router();
var MagCtrl = new (require('../controllers/magazine')).Mag();

router.get("/", MagCtrl.getMagazines);
router.get("/filters", MagCtrl.getFilters);
router.post("/bestRates", MagCtrl.getBestRates);
router.get("/compare", MagCtrl.compare);
router.get("/related/:categoryId", MagCtrl.relatedMedia);
router.get("/:urlSlug", MagCtrl.show);

module.exports = router;