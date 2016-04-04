var User = function()
{
	var async = require('async');
	var User = require('../models/user').User;
	var UsersLogs = require('../models/usersLogs').UsersLogs;
	var jwt = require('jsonwebtoken');
	var fs = require('fs');
	var imagick = require('imagemagick');
	var mkdirp = require('mkdirp');
	var nodeMailer = require('nodemailer');
	var crypto =require('crypto');
	var Contact = require('../models/contact').Contact;

	var path = require('path');
	var EmailTemplate = require('email-templates').EmailTemplate;
	var templatesDir = path.resolve(__dirname, '../..', 'public/templates/emailTemplates');

	var md5 = require('md5');

	this.params = {};
	this.config = require('../config/config.js');
	var self = this;

	this.transporter = nodeMailer.createTransport({
    service: self.config.smtpService,
    host: self.config.smtpHost,
    port: self.config.smtpPort,
    auth: self.config.smtpAuth
  });

	this.signup = function(req, res){
		var user = req.body.user;
		User.count({mobile: user.mobile}, function(err, result){
			if(err) throw err;
			if(result) return res.status(500).json("Email Already Exists");

			user.password = md5(user.password);
			user.isActive = 0;
			user.vcode = 5555;
			user.dateOfJoin = new Date();
			var newUser = User(user);

			// save the User
			newUser.save(function(err){
				if(err) return res.status(500).json(err);
				res.status(200).json({userId:newUser});
			});	

		});
	};

	this.store = function(req, res){
		var user = req.body.user;
		res.status(200).json("Done");
		// User.count({mobile: user.mobile}, function(err, result){
		// 	if(err) throw err;
		// 	if(result) return res.status(500).json("Email Already Exists");

		// 	user.password = md5(user.password);
		// 	user.isActive = 0;
		// 	user.vcode = 5555;
		// 	user.dateOfJoin = new Date();
		// 	var newUser = User(user);

		// 	// save the User
		// 	newUser.save(function(err){
		// 		if(err) return res.status(500).json(err);
		// 		res.status(200).json({userId:newUser});
		// 	});	

		// });
	};

	this.verify = function(req, res){
		var user = req.body.user;
		console.log(typeof(user.userId));
		User.findOne({_id : user.userId, mobile: user.mobile, vcode : user.vcode}).lean().exec(function(err, result){			
			if(err || result === null) return res.status(500).json("No value found");
			//if(result) return res.status(200).json(result);

			User.findOneAndUpdate({_id : result._id}, {$set: { isActive: 1 }}, {upsert:true}, function(err, doc){
			  if(err) return res.status(500).json(err);
			  return res.status(200).json("Mobile Number verified");
			});

		});
	};

	this.reVerificationMail = function(req, res){
		//return res.status(200).json(req.body.email);
		User.findOne({email: req.body.email, isActive:0}).lean().exec(function(err, result){
			if(err) throw err; 
			if(result) {
				var mailOptions = {
			      email: result.email,
			      name: {
			        first: CommonLib.capitalizeFirstLetter(result.firstName),
			        last: CommonLib.capitalizeFirstLetter(result.lastName)
			      },
			      userId:result._id,
			      emailHash:md5(result.email),
			      appHost:self.config.appHost
			    };

			    var emailTemplate = new EmailTemplate(path.join(templatesDir, 'register'));

				emailTemplate.render(mailOptions, function(err, results){
					if(err) return console.error(err)
					self.transporter.sendMail({
		        from: self.config.noreply, // sender address
		        to: mailOptions.email, // list of receivers
		        subject: 'One Last Step To Create Your Account!',
		        html: results.html
					}, function(err, responseStatus){
						if(err) return console.log(err);
					   	console.log("responseStatus.message");
					})
				});
			}
		});
	};

	// this.verify = function(req, res){
	// 	var confirmationCode = req.params.confirmationCode;
	// 	var confirmationCode = confirmationCode.split(":");
	// 	var dbEmail = false;

	// 	User.findOne({_id : confirmationCode[1]}, function(err, result){
	// 		var dbEmailHash = md5(result.email);
	// 		if(confirmationCode[0] != dbEmailHash) return res.status(500).json("not verified");
	// 		User.findOneAndUpdate({_id : confirmationCode[1]}, {$set: { isActive: 1 }}, {upsert:true}, function(err, doc){
	// 		  if(err) return res.status(500).json(err);
	// 		  return res.status(200).json("User's email verified");
	// 		});
	// 	})
	// }

	this.facebookSignin = function(req, res){
		var user = req.body.user;
		User.findOne(
			{email: user.email},
			function(err, result){
				if(err) return res.status(500).json(err);
				if(result)
				{
					var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
					res.status(200).json({token:token});

					result.userAgent= req.headers['user-agent'];
					result.clientIPAddress = req.headers['x-forwarded-for'] || req.ip;
					self.userLoginInfo(result);

					if(result.facebookId === undefined)
					{
						result.facebookId = user.id;
						result.save(err);
					}
				}
				else
				{
					user.dateOfJoin = new Date();
					user.isActive = 1;
					user.firstName = user.first_name; delete user.first_name;
					user.lastName = user.last_name; delete user.last_name;
					user.facebookId = user.id; delete user.id;
					user.thumbnail = user.ppic = user.picture; delete user.picture;
					// create a new Media
					var newUser = User(user);

					// save the Media
					newUser.save(function(err) {
						if (err) throw err;
						var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
						res.status(200).json({userId:newUser._id,token:token});
						mkdirp('../public/images/users/'+newUser._id);
					});
				}
			}
		);
	}

	this.googleSignin = function(req, res){
		var user = req.body.user;
		User.findOne(
			{email: user.email},
			function(err, result){
				if(err) return res.status(500).json(err);
				if(result)
				{
					var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
					res.status(200).json({token:token});

					result.userAgent= req.headers['user-agent'];
					result.clientIPAddress = req.headers['x-forwarded-for'] || req.ip;
					self.userLoginInfo(result);


					if(result.googleId === undefined)
					{
						result.googleId = user.id;
						result.save(err);
					}
				}
				else
				{
					delete user.result;
					user.dateOfJoin = new Date();
					user.isActive = 1; delete user.verified_email;
					user.firstName = user.given_name; delete user.given_name;
					user.lastName = user.family_name; delete user.family_name;
					user.googleId = user.id; delete user.id;
					user.thumbnail = user.ppic = user.picture; delete user.picture;
					// create a new Media
					var newUser = User(user);

					// save the Media
					newUser.save(function(err) {
						if (err) throw err;
						var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
						res.status(200).json({userId:newUser._id,token:token});
						mkdirp('../public/images/users/'+newUser._id);
					});
				}
			}
		);
	}

	this.update = function(req, res){
		var userId = req.body.userId;
		User.update({_id : userId}, req.body.update, {upsert : true}, function(err, result){
			if(err) return res.status(500).json(err);
			res.status(200).json({userId:result._id});
		})
	}

	this.uploadProfilePic = function(req, res){
		var userId = req.body.userId;
		var sourcePath = req.file.path;
		var extension = req.file.originalname.split(".");
		extension = extension[extension.length - 1];
		var destPath = "/images/users/"+userId+"/"+userId+"_ppic."+extension;

		var source = fs.createReadStream(sourcePath);
		var dest = fs.createWriteStream('./public'+destPath);

		source.pipe(dest);
		source.on('end', function(){
			res.status(200).json({userId:userId});
			imagick.resize({
			  srcPath: './public'+destPath,
			  dstPath: "./public/images/users/"+userId+"/"+userId+"_thumbnail."+extension,
			  width: 200
			},
			function(err, stdout, stderr)
			{
			  if(err) throw err;
  			fs.writeFileSync("./public/images/users/"+userId+"/"+userId+"_thumbnail."+extension, stdout, 'binary');
			  console.log('resized image to fit within 200x200px');
			  fs.unlinkSync(sourcePath);
			  var images = {
			  	ppic : destPath,
			  	thumbnail : "/images/users/"+userId+"/"+userId+"_thumbnail."+extension
			  };
			  User.update({_id : userId}, images, {upsert : true}, function(err, result){})
			});
		});
	};

	this.authenticate = function(req, res){
		var user = req.body.user;
		console.log(user);
		var data  = {
							_id: "55e77e9f8ead0ebe0c8b46e0",
							mobile: "7022532828",		
							building : {
								name : "building 1",
								venue : "B block",
								restuarants : [
                            {
                                _id : "1",
                                "name" : "res 1",
                                "food" : "veg"
                            },
                            {
                                _id : "1",
                                "name" : "res 2",
                                "food" : "non veg"
                            },
                            {
                                _id : "1",
                                "name" : "res 3",
                                "food" : "non veg and veg"
                            }
                        ]
							}		
		}
		return res.status(200).json({data : data});
		// User.findOne({email: user.username}).lean().exec(function(err, result){
		// 	if(err) return res.status(500).json(err);
		// 	if(!result) return res.status(404).json("User Does Not Exist");

		// 	//Verify Password
		// 	if(md5(user.password) != result.password) return res.status(401).json("Invalid Password");
		// 	if(!result.isActive) return res.status(401).json("Account Not Verified");
		// 	else
		// 	{
		// 		var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
		//         res.status(200).json({token:token});
		//     }

		// 	result.userAgent= req.headers['user-agent'];
		// 	result.clientIPAddress = req.headers['x-forwarded-for'] || req.ip;
		// 	self.userLoginInfo(result);
		// });
	};

	this.getSession = function(req, res){
		var token = req.body.token || req.query.Tokenn || req.headers['x-access-token'];
		if(!token) return res.status(403).json("Token not found");
		jwt.verify(token, self.config.secret, function(err, decoded){
			if(err) res.status(401).json("Invalid Token");
			else res.status(200).json({user:decoded});
		});
	};

	this.logout = function(req, res){
		res.status(200).json("success");
	};

	this.forgotPassword	= function(req,res){
		User.findOne({ email:req.body.email }).lean().exec(function(err, user){
			if(!user) return res.status(404).json("No account with that email address exists.");

			var token = jwt.sign(user, self.config.secret, { expiresInMinutes: (24*60) });
			var mailOptions = {
	      email: user.email,
	      name: {
	        first: CommonLib.capitalizeFirstLetter(user.firstName),
	        last: CommonLib.capitalizeFirstLetter(user.lastName)
	      },
	      appHost: self.config.appHost,
	      token: token
	    };

	    var emailTemplate = new EmailTemplate(path.join(templatesDir, 'forgotPassword'));

	    emailTemplate.render(mailOptions, function(err, results){
				if(err) return res.status(500).json(err);
				self.transporter.sendMail({
	        from: self.config.noreply, // sender address
	        to: mailOptions.email, // list of receivers
	        subject: 'Reset Your Password - The Media Ant',
	        html: results.html
				}, function(err, responseStatus){
					if(err) res.status(500).json(err);
					res.status(200).json("OK");
				})
			});
		});
	};

	this.forgotPasswordVerify = function(req, res){
		var token = req.body.token || req.query.token || req.headers['x-access-token'];
		if(!token) return res.status(401).json("Token not found");
		jwt.verify(token, self.config.secret, function(err, user){
			if(err) res.status(401).json("Invalid Token");
			User.update( { _id:user._id },{ password:md5(req.body.newPassword) }, function(err, result){
				if(err) return res.status(404).json("password not updated :"+ err);
		    res.status(200).json("OK");
			});	
		})
	}

	this.changePassword = function(req,res){
		req.body.oldPassword = md5(req.body.oldPassword);
		req.body.newPassword = md5(req.body.newPassword);
		var token = req.body.token || req.query.token || req.headers['x-access-token'];
		if(!token) {
			return res.status(401).json("Token not found");
		} else {
			jwt.verify(token, self.config.secret, function(err, decoded){
				if(err) res.status(401).json("Invalid Token");

				User.findOne({ _id:decoded.id, password:req.body.oldPassword }).lean().exec(function(err, result){
					if(err) return res.status(500).json(err);
					if(!result) return res.status(404).json("The Old password doesn't match");
					User.update( { _id:result._id },{ password:req.body.newPassword }, function(err, result){
						if(err) return res.status(404).json("password not updated :"+ err);
				    res.status(200).json("OK");
					});
				});
			});
		}
	};

	self.userLoginInfo = function(result){
	  var userDetails= {
	  	userId : result._id.toString(),
	  	userAgent : result.userAgent,
	  	clientIPAddress : result.clientIPAddress,
	  	timeStamp : new Date()
	  };

	  var userlogs = UsersLogs(userDetails);

	  userlogs.save( function(err) {
	  	if(err)return err;
	  	else return "user logged";
	  });
	};

	this.userCount = function(req, res){
		if(req.query.list){
			User.find({dateOfJoin: {"$gte": new Date(req.query.startDate), "$lt": new Date(req.query.endDate)}}).lean().exec(function(err, users){
				return res.status(200).json(users);
			})
		}
		else{
			User.find({dateOfJoin: {"$gte": new Date(req.query.startDate), "$lt": new Date(req.query.endDate)}}).lean().exec(function(err, users){
				return res.status(200).json(users.length);
			})
		}			
	}
}

module.exports.User = User;
