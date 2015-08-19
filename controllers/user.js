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
    console.log(req);
    var source = req.files.file;
    var dest = '../public/images/users/'+user._id+'/'+user._id+'_ppic.jpg';
    //var user = req.body.user;

    var buffer = source.buffer; //Note: buffer only populates if you set inMemory: true.
    var fileName = source.name;

    var stream = fs.createWriteStream(dest);
    stream.write(buffer);
    stream.on('finish', function() {
        console.log('File saved successfully.');
        var data = {
            message: 'File saved successfully.'
        };
        res.jsonp(data);
    });
    stream.end();
    
    //user.ppic = '/images/users/'+user._id+'/'+user._id+'.jpg';
    //User.update({_id : user._id}, user, function(err, result){
      //res.status(200).json({user:result});
      //fs.unlink(req.file.ppic);
    //})  
    
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