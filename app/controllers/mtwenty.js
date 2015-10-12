var Mtwenty = function()
{
	var async = require('async');
	var CommonLib = require('../libraries/common').Common;
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

	//Contact mail coming from M20
  self.contact = function(req, res){
  	//return res.status(200).json("data");
    var mailOptions = {};
    mailOptions.email = req.body.email;
		mailOptions.to = "help@m20.in";
    mailOptions.name = req.body.name;
    mailOptions.message = req.body.message;
    mailOptions.toolName =  'm20';
    mailOptions.appHost = self.config.appHost;
		//return res.status(200).json(mailOptions);
    var newContact = Contact(mailOptions);

		// save the Contact mail
		newContact.save(function(err){
		  if(err) return res.status(500).json(err);
		  var emailTemplate = new EmailTemplate(path.join(templatesDir, 'miContact'));
		  emailTemplate.render(mailOptions, function(err, results){
		    if(err) return console.error(err)
		    self.transporter.sendMail({
		      from: req.body.email, // sender address
		      to: mailOptions.to, // list of receivers
		      cc: req.body.email,
		      subject: 'Message from '+req.body.name+' to m20',
		      html: results.html
		    }, function(err, responseStatus){
		      if(err) return console.error(err);
		       return res.status(200).json("sucess");
		    })
		  });

		});
  };

}

module.exports.Mtwenty = Mtwenty;
