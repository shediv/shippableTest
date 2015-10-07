var express = require('express');
var router = express.Router();
var CommonCtrl = new (require('../controllers/common')).CommonCtrl();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/isToolExists', CommonCtrl.isToolExists);
router.post('/customerQuery', CommonCtrl.addCustomerQuery);
router.get('/sitemap', Common.getSiteMap);
router.get('/metaTags', Common.getMetaTags);

module.exports = router;
