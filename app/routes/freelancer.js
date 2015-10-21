/**
 * Created on 20/10/15.
 */

var express = require('express');
var router = express.Router();
var FreelancerCtrl = new (require('../controllers/freelancer')).Freelancer();

router.post("/", FreelancerCtrl.store);

module.exports = router;