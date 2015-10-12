var express = require('express');
var router = express.Router();
var CommonCtrl = new (require('../controllers/common')).CommonCtrl();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/isToolExists', CommonCtrl.isToolExists);
router.post('/customerQuery', CommonCtrl.addCustomerQuery);
router.post('/contact', CommonCtrl.contactMail);
router.get('/sitemap', CommonCtrl.getSiteMap);
router.get('/metaTags/:toolName', CommonCtrl.getMetaTags);
router.get('/mediaName', CommonCtrl.getMediaName);
router.post('/campaign', CommonCtrl.saveCampaigns);
router.get('/moreSeller', CommonCtrl.getMoreSeller);


module.exports = router;
