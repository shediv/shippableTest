/**
 * Created by videsh on 06/10/15.
 */

var express = require('express');
var router = express.Router();
var Common = new (require('../controllers/common')).CommonCtrl();

router.get("/sitemap", Common.getSiteMap);
module.exports = router;