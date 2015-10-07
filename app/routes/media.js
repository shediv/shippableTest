/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var MediaCtrl = new (require('../controllers/media')).Media();

//API :- http://localhost:3000/media
router.post("/store", MediaCtrl.store);

module.exports = router;