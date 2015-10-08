/**
 * Created by videsh on 28/09/15.
 */

var express = require('express');
var router = express.Router();
var LsquareCtrl = new (require('../controllers/lsquare')).Lsquare();

router.get("/", LsquareCtrl.getLsquare);
router.get("/filters", LsquareCtrl.getFilters);
//router.get("/addQuestion", LsquareCtrl.addQuestion);
router.get("/:urlSlug", LsquareCtrl.show);

module.exports = router;