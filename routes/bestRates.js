/**
 * Created by goku on 13/09/15.
 */

var express = require('express');
var router = express.Router();
var BestRates = new (require('../controllers/bestRates')).BestRates();

router.get("/", BestRates.getBestRates);

module.exports = router;