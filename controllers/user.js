var User = function()
{
	var async = require('async');
	var CommonLib = require('../libraries/common').Common;
	var User = require('../models/user').User;
	var jwt = require('jsonwebtoken');
	var fs = require('fs');
	var imagick = require('imagemagick');
	var mkdirp = require('mkdirp');

	this.passwordHash = require('password-hash');
	this.config = require('../config.js');

	this.params = {};
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
					//Hash Password
					user.password = self.passwordHash.generate(user.password);
					user.verified = 0;
					// create a new Media
					var newUser = User(user);

					// save the Media
					newUser.save(function(err) {
						if (err) throw err;
						res.status(200).json({userId:newUser._id});
						fs.mkdir('./public/images/users/'+newUser._id, function(err){
							console.log(err);
						})
					});
				}
			}
		);
	};

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
		User.findOne(
			{email: user.username},
			function(err, result){
				result = result.toObject();
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
}

module.exports.User = User;