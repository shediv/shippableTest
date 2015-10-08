/**
 * Created by videsh on 08/10/15.
 */

var express = require('express');
var router = express.Router();
var Mtwenty = new (require('../controllers/mtwenty')).Mtwenty();

router.post("/contact", Mtwenty.contact);

module.exports = router;