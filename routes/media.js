/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var MedCtrl = new (require('../controllers/media')).Med();

//API :- http://localhost:3000/media
router.post("/", function(req, res){MedCtrl.createMedia(req, res);});

router.get("/underscore", function(req, res){MedCtrl.underscore(req, res);});

module.exports = router;