var User = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var User = require('../models/user').User;
  this.passwordHash = require('password-hash');

  this.params = {};
  var self = this;
  
  self.store = function(req, res){
    var user = req.body; 
    console.log(user);
    User.findOne(
      {email: user.email},
      function(err, result){
        if(result.length) res.status(500).json("Email Already Exists");

        //Hash Password
        user.password = self.passwordHash.generate(user.password);

        // create a new Media
        var newUser = User(user);

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