var User = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var User = require('../models/user').User;
  this.passwordHash = require('password-hash');

  this.params = {};
  var self = this;
  
  self.store = function(req, res){
    User.findOne(
      {email: req.body.email},
      function(err, result){
        if(result.length) res.status(500).json("Email Already Exists");

        //Hash Password
        req.body.password = self.passwordHash.generate(req.body.password);

        // create a new Media
        var newUser = User(req.body);

        // save the Media
        newUser.save(function(err) {
          if (err) throw err;
          res.status(200).json("User Created Successfully");
        });
      }
    );
  };
}    

module.exports.User = User;