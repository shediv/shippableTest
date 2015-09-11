/**
 * Created by videsh on 31/08/15.
 */

var express = require('express');
var router = express.Router();
var NewspaperCtrl = new (require('../controllers/newspaper')).Newspaper();


router.get("/", NewspaperCtrl.getNewspapers);
router.get("/filters", NewspaperCtrl.getFilters);
router.post("/bestRates", NewspaperCtrl.getBestRates);
router.get("/compare", NewspaperCtrl.compare);
router.get("/related/:categoryId", NewspaperCtrl.relatedMedia);
router.get("/:urlSlug", NewspaperCtrl.show);

module.exports = router;