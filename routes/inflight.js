/**
 * Created by videsh on 08/09/15.
 */

var express = require('express');
var router = express.Router();
var InflightCtrl = new (require('../controllers/inflight')).Inflight();

router.get("/", InflightCtrl.getInflight);
router.get("/filters", InflightCtrl.getFilters);
router.post("/bestRates", InflightCtrl.getBestRates);
router.get("/:urlSlug", InflightCtrl.show);

module.exports = router;