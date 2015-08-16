/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var MedCtrl = new (require('../controllers/media')).Med();

//API :- http://localhost:3000/media
router.post("/signup", function(req, res){MedCtrl.store(req, res);});

module.exports = router;