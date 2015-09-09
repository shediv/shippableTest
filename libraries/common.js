var Common = function()
{
	var Media = require('../models/media').Media;
	var Tools = require('../models/tool').Tools;
	var Products = require('../models/product').Products;
	var Geography = require('../models/geography').Geography;
	var Category = require('../models/category').Category;
	var nodemailer = require('nodemailer');

	var scope = this;

	this.getCategoryName = function(catIds, callback) {
		Category.find({_id : {$in: catIds}},'name').lean().exec(function(err, results){
			var categoryNames = [];
			for(var i = 0; i < results.length; i++)
				categoryNames[results[i]._id] = results[i].name;
			callback(err, categoryNames);
		});
	};

	this.removeHiddenAttributes = function(attributes){
		for(key in attributes) {
			if(attributes[key].hidden) delete attributes[key];
		}
		return attributes;
	};

	this.isNumber = function(n){ 
		return /^-?[\d.]+(?:e-?\d+)?$/.test(n); 
	}

  this.isToolExists = function(req, res){
    var toolName = req.query.toolName;
    Tools.findOne({ name:toolName }, function(err, result){
      if(!result) return res.status(200);
      return res.status(404);
    });
  }

	// create reusable transporter object using SMTP transport
    this.transporter = nodemailer.createTransport({
        service: 'smtp.mandrillapp.com',
        host: 'smtp.mandrillapp.com',
        port:587,
        auth: {
            user: 'manjunath@themediaant.com',
            pass: 'pWCZVZ17BC26LNamo3GNoA'
        }
    }); 


};

module.exports.Common = new Common();