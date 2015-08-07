/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var GeoCtrl = new (require('../controllers/geography')).Geo();

//API :- http://localhost:3000/media
router.post("/", function(req, res){GeoCtrl.createGeography(req, res);});

router.get("/underscore", function(req, res){MedCtrl.underscore(req, res);});

module.exports = router;