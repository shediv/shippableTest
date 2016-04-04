/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var UserCtrl = new (require('../controllers/user')).User();

router.get("/check", UserCtrl.check);

module.exports = router;