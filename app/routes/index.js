var express = require('express');
var router = express.Router();
//var CommonCtrl = new (require('../controllers/common')).CommonCtrl();
//var CampaignCtrl = new (require('../controllers/campaign')).Campaign();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// router.get('/isToolExists', CommonCtrl.isToolExists);
// router.post('/customerQuery', CommonCtrl.addCustomerQuery);
// router.post('/contact', CommonCtrl.contactMail);
// router.get('/sitemap', CommonCtrl.getSiteMap);
// router.get('/sitemapCategory', CommonCtrl.getSiteMapCategory);
// router.get('/metaTags', CommonCtrl.getCommonMetaTags);
// router.get('/metaTags/:toolName', CommonCtrl.getMetaTags);
// router.get('/mediaName', CommonCtrl.getMediaName);
// router.post('/campaign', CampaignCtrl.emailBestRates);
// router.get('/moreSeller', CommonCtrl.getMoreSeller);


module.exports = router;
