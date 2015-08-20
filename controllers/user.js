var User = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var User = require('../models/user').User;
  var jwt = require('jsonwebtoken');
  var fs = require('fs');

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

          // create a new Media
          var newUser = User(user);

          // save the Media
          newUser.save(function(err) {
            if (err) throw err;
            res.status(200).json({user:newUser});
            fs.mkdirSync('../public/images/users/'+newUser._id);
          });
        }
      }
    );
  };

  self.update = function(req, res){
    var user = req.body.user;
    User.update({_id : user._id}, user, function(err, result){
      res.status(200).json({user:result});
    })
  }

  self.uploadProfilePic = function(req, res){

      var userId = req.body.userId;
      console.log(userId);
        return res.status(200).json(req.file.originalname);
      var sourcePath = req.file.path;
      var destPath = "/images/users/"+userId+"/"+userId+"_"+req.file.originalName;
/*
      var src = fs.createReadStream(tmp_path);
      var dest = fs.createWriteStream(target_path);
      src.pipe(dest);
      src.on('end', function() { res.render('complete'); });
      src.on('error', function(err) { res.render('error'); });*/

    var source = fs.createReadStream(sourcePath);
    var dest = fs.createWriteStream('./public'+destPath);

    source.pipe(dest);
    source.on('end', function(){
      user.ppic = destPath;
      User.update({_id : user._id}, user, function(err, result){
        res.status(200).json({user:result});
        fs.unlink(req.file.ppic);
      })  
    });
  }

  self.authenticate = function(req, res){
    var user = req.body.user; 
    User.findOne(
      {email: user.username},
      function(err, result){
        if (err) throw err;
        if(!result) res.status(404).json("User Does Not Exist");
        else
        {
          //Verify Password
          if(!self.passwordHash.verify(user.password, result.password)) res.status(401).json("Invalid Password");
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
    if(token)
    {
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else res.status(200).json({user:decoded});
      })
    }
  };

  self.logout = function(req, res){
      res.status(200).json("success");
  };
}

module.exports.User = User;