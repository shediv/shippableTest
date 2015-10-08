/**
 * Created by Videsh on 03/08/15.
 */

var express = require('express');
var router = express.Router();
var UserCtrl = new (require('../controllers/user')).User();

router.post("/signup", UserCtrl.store);
router.post("/reverification", UserCtrl.reVerificationMail);
router.get("/verify/:confirmationCode", UserCtrl.verify);
router.put("/", UserCtrl.update);
router.put("/uploadProfilePic", UserCtrl.uploadProfilePic);
router.post("/localSignin", UserCtrl.authenticate);
router.post("/facebookSignin", UserCtrl.facebookSignin);
router.post("/googleSignin", UserCtrl.googleSignin);
router.post("/current", UserCtrl.getSession);
router.post("/logout", UserCtrl.logout);
router.post("/forgotPassword", UserCtrl.forgotPassword);
router.post("/forgotPasswordVerify", UserCtrl.forgotPasswordVerify);
router.post("/changePassword", UserCtrl.changePassword);

module.exports = router;