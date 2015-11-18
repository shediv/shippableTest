var Freelancer = function() 
{

  var async = require('async');
  var Freelancer = require('../models/freelancer').Freelancer;
  var CommonLib = require('../libraries/common').Common;
  var User = require('../models/user').User;
  var UsersLogs = require('../models/usersLogs').UsersLogs;
  var jwt = require('jsonwebtoken');
  var fs = require('fs');
  var imagick = require('imagemagick');
  var mkdirp = require('mkdirp');
  var nodeMailer = require('nodemailer');
  var crypto =require('crypto');

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


  this.store = function(req, res){
    var freelancer = req.body.freelancer;
    freelancer.createdAt = new Date();
    var newLancer = Freelancer(freelancer);
    
    // save the Media
    newLancer.save(function(err) {
      if(err) return res.status(500).json(err);
      res.status(200).json("New FreeLancer Created Successfully");
    
      var mailOptions = {
          email: freelancer.email,
          to : "samir@themediaant.com",
          name: {
            first: CommonLib.capitalizeFirstLetter(freelancer.firstName),
            last: CommonLib.capitalizeFirstLetter(freelancer.lastName)
          }
      };

      var emailTemplate = new EmailTemplate(path.join(templatesDir, 'freelancerRegister'));

      emailTemplate.render(mailOptions, function(err, results){
        if(err) return console.error(err)
        self.transporter.sendMail({
          from: mailOptions.email, // sender address
          to: mailOptions.to, // list of receivers
          cc: mailOptions.email,
          subject: 'List as Freelancer',
          html: results.html
        }, function(err, responseStatus){
            if(err) return console.log(err);
            console.log("responseStatus.message");
        })
      });
    });
  };
}

module.exports.Freelancer = Freelancer;