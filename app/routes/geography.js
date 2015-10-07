/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var GeoCtrl = new (require('../controllers/geography')).Geo();

//API :- http://localhost:3000/media
router.get("/search", GeoCtrl.search);
router.post("/store", GeoCtrl.store);

module.exports = router;