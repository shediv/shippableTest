var express = require('express');
var router = express.Router();
var CommonCtrl = new (require('../controllers/common')).CommonCtrl();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/isToolExists', CommonCtrl.isToolExists);

module.exports = router;
