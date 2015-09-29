/**
 * Created by videsh on 28/09/15.
 */

var express = require('express');
var router = express.Router();
var LsquareCtrl = new (require('../controllers/lsquare')).Lsquare();

router.get("/", LsquareCtrl.getDigital);
router.get("/filters", LsquareCtrl.getFilters);
router.post("/addQuestion", LsquareCtrl.addQuestion);
router.get("/:urlSlug", LsquareCtrl.show);

module.exports = router;