/**
 * Created by goku on 13/09/15.
 */

var express = require('express');
var router = express.Router();
var Search = new (require('../controllers/search')).Search();

router.get("/", Search.getResults);

module.exports = router;