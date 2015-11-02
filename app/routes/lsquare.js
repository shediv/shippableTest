/**
 * Created by videsh on 28/09/15.
 */

var express = require('express');
var router = express.Router();
var LsquareCtrl = new (require('../controllers/lsquare')).Lsquare();

router.get("/", LsquareCtrl.getLsquare);
router.get("/filters", LsquareCtrl.getFilters);
router.get("/dataImport", LsquareCtrl.dataImport);
router.post("/addQuestion", LsquareCtrl.addQuestion);
router.post("/addAnswer", LsquareCtrl.addAnswer);
router.get("/search", LsquareCtrl.search);
router.get("/getUser", LsquareCtrl.getUser);
router.post("/upvote", LsquareCtrl.upvoteAnswer);
//router.get("/addQuestion", LsquareCtrl.addQuestion);
router.get("/:urlSlug", LsquareCtrl.show);

module.exports = router;