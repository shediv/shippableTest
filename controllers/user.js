var User = function()
{
	var async = require('async');
	var CommonLib = require('../libraries/common').Common;
	var User = require('../models/user').User;
	var jwt = require('jsonwebtoken');
	var fs = require('fs');
	var imagick = require('imagemagick');
	var mkdirp = require('mkdirp');
	var nodeMailer = require('nodemailer');
	var crypto =require('crypto');
	
	var path = require('path');
	var EmailTemplate = require('email-templates').EmailTemplate;
	var templatesDir = path.resolve(__dirname, '..', 'public/templates');
	var template = new EmailTemplate(path.join(templatesDir, 'welcome'));

	var md5 = require('md5');

	this.params = {};
	this.config = require('../config.js');
	var self = this;

	self.store = function(req, res){
		var user = req.body.user;
		User.count(
			{email: user.email},
			function(err, result){
				if (err) throw err;
				if(result) res.status(500).json("Email Already Exists");
				else
				{									    
					user.password = md5(user.password);
					user.verified = 0;
					
					var newUser = User(user);

					// save the Media
					newUser.save(function(err) {
						if (err) throw err;
						var locals = {
						      email: user.email,
						      name: {
						        first: user.firstName,
						        last: user.lastName
						      },
						      userId:newUser._id,
						      emailHash:md5(user.email)						      
						    }

						// Send a single email
					    template.render(locals, function (err, results) {
					      if (err) {
					        return console.error(err)
					      }

					      CommonLib.transporter.sendMail({
					        from: 'The Media Ant <help@themediaant.com>', // sender address
					        to: locals.email, // list of receivers
					        subject: 'Email Address Verification - The Media Ant',
					        html: results.html,
					        text: results.text
					      }, function (err, responseStatus) {
					        if (err) {
					          return console.error(err)
					        }
					        console.log("responseStatus.message")
					      })
					    })						    
						res.status(200).json({userId:newUser._id});
						fs.mkdir('./public/images/users/'+newUser._id, function(err){
							console.log(err);
						})
					});					
				}
			}
		);
	};

	self.verify = function(req, res){
		var confirmationCode = req.params.confirmationCode;
		var confirmationCode = confirmationCode.split(":");
		var dbEmail = false;
		
		User.findOne({_id : confirmationCode[1]}, function(err, result){
			//dbEmail = result.email;
			var dbEmailHash = md5(result.email);
			if(confirmationCode[0] == dbEmailHash){
				User.findOneAndUpdate({_id : confirmationCode[1]}, {$set: { verified: 1 }}, {upsert:true}, function(err, doc){
				    if (err) return res.send(500, { error: err });
				    return res.status(200).json("User's email verified");
				});
			}
			else{
				return res.status(500).json("not verified");
			}			
		})
	}

	self.facebookSignin = function(req, res){
		var user = req.body.user;
		User.findOne(
			{email: user.email},
			function(err, result){
				if(err) throw err;
				if(result) 
				{
					var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
					res.status(200).json({token:token});
					if(result.fbid === undefined)
					{
						result.fbid = user.id;
						result.save(err);
					}
				}
				else
				{
					user.verified = 1;
					user.fname = user.first_name; delete user.first_name;
					user.lname = user.last_name; delete user.last_name;
					user.fbid = user.id; delete user.id;
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

	self.googleSignin = function(req, res){
		var user = req.body.user;
		User.findOne(
			{email: user.email},
			function(err, result){
				if(err) throw err;
				if(result) 
				{
					var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
					res.status(200).json({token:token});
					if(result.gid === undefined)
					{
						result.gid = user.id;
						result.save(err);
					}
				}
				else
				{
					delete user.result;
					user.verified = 1; delete user.verified_email;
					user.fname = user.given_name; delete user.given_name;
					user.lname = user.family_name; delete user.family_name;
					user.gid = user.id; delete user.id;
					user.fname = user.given_name; delete user.given_name;
					user.thumbnail = user.ppic = user.picture; delete user.picture;
					// create a new Media
					var newUser = User(user);

					// save the Media
					newUser.save(function(err) {
						if (err) throw err;
						var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
						res.status(200).json({userId:newUser._id,token:token});
						fs.mkdirSync('../public/images/users/'+newUser._id);
					});
				}
			}
		);
	}

	self.update = function(req, res){
		var userId = req.body.userId;
		User.update({_id : userId}, req.body.update, {upsert : true}, function(err, result){
			res.status(200).json({userId:result._id});
		})
	}

	self.uploadProfilePic = function(req, res){
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
			  if (err) throw err
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

	self.authenticate = function(req, res){
		var user = req.body.user;
		User.findOne({email: user.username}).lean().exec(function(err, result){
				if (err) throw err;
				if(!result) res.status(404).json("User Does Not Exist");
				else
				{
					//Verify Password
					if(!self.passwordHash.verify(user.password, result.password)) res.status(401).json("Invalid Password");
					else if(!result.verified) res.status(401).json("Account Not Verified");
					else
					{
						var token = jwt.sign(result, self.config.secret, { expiresInMinutes: 11340 });
						res.status(200).json({token:token});
					}
				}
			}
		);
	};

	self.getSession = function(req, res){
		var token = req.body.token || req.query.token || req.headers['x-access-token'];
		if(!token)
			return res.status(401).json("Token not found");
		jwt.verify(token, self.config.secret, function(err, decoded){
			if(err) res.status(401).json("Invalid Token");
			else res.status(200).json({user:decoded});
		})
	};

	self.logout = function(req, res){
		res.status(200).json("success");
	};

	self.forgotPassword	= function(req,res){
		async.waterfall([
		    function(callback) {
		      crypto.randomBytes(20, function(err, buf) {
		        var token = buf.toString('hex');
		        callback(err, token);
		      });
		    },
		    function(token, callback) {
		      User.findOne({ email: req.body.email },{ email : 1 }, function(err, user) {
		        if (!user) {
		          return res.status(404).json("No account with that email address exists.");
		        }

		        user.resetPasswordToken = token;
		        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
						
		        callback(err, token, user);
		        
		      });
		    },
		    function(token, user, callback) {
		      var smtpTransport = nodeMailer.createTransport({
		        service: 'smtp.mandrillapp.com',
        		host: 'smtp.mandrillapp.com',
        		port:587,
		        auth: {
		          user: 'manjunath@themediaant.com',
		          pass: 'pWCZVZ17BC26LNamo3GNoA'
		        }
		      });
		      var mailOptions = {
		        to: user.email,
		        from: 'manjunath@themediaant.com',
		        subject: 'The MediaAnt Password Reset',
		        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
		          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
		          'http://' + req.headers.host + '/reset/' + token + ':'+	user._id +'\n\n' +
		          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
		      };
		      smtpTransport.sendMail(mailOptions, function(err) {
		        console.log('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
		        callback(err, 'done');
		      });
		    }
		  ], 
		  function(err) {
		  		if(err)res.status(404).json("mail not sent :"+ err);
		    	res.status(200).json("mail sent");
		  }
		);
	}

	self.changePassword = function(req,res){
		async.waterfall([
			function(callback){
				req.body.oldPassword = md5(req.body.oldPassword);
				req.body.newPassword = md5(req.body.newPassword);

				User.findOne({ _id: req.body.id ,password : req.body.oldPassword }, function(err, result) {
						console.log(result);	
		        if(result != null)
		         {	callback(err, result); }
		       	else
		        { return res.status(404).json("The Old password doesn't match"); }
				});		
			},
			function(result, callback){
					User.update( { _id : result._id },{ password : req.body.newPassword }, function(err, result) {
						callback(err, result)
					});
			}
			],
			function(err ,result){
				if(err)res.status(404).json("password not updated :"+ err);
		    	res.status(200).json("pasword updated ");		
			}
		);
	}	
}

module.exports.User = User;