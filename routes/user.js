/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({dest:'../public/temp'});
var UserCtrl = new (require('../controllers/user')).User();

router.post("/signup", function(req, res){UserCtrl.store(req, res);});
router.put("/", function(req, res){UserCtrl.update(req, res);});
router.put("/uploadProfilePic", upload, function(req, res){UserCtrl.uploadProfilePic(req, res);});
router.post("/signin", function(req, res){UserCtrl.authenticate(req, res);});
router.post("/current", function(req, res){UserCtrl.getSession(req, res);});
router.post("/logout", function(req, res){UserCtrl.logout(req, res);});

module.exports = router;