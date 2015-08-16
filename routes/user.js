/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var UserCtrl = new (require('../controllers/user')).User();

//API :- http://localhost:3000/media
router.post("/signup", function(req, res){UserCtrl.store(req, res);});

module.exports = router;