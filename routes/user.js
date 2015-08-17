/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var UserCtrl = new (require('../controllers/user')).User();

router.post("/signup", function(req, res){UserCtrl.store(req, res);});
router.post("/signin", function(req, res){UserCtrl.authenticate(req, res);});
router.post("/getSession", function(req, res){UserCtrl.getSession(req, res);});

module.exports = router;