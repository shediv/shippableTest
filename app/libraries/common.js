var Common = function()
{
	var Media = require('../models/media').Media;
	var TwelthCross = require('../models/12thCross').TwelthCross;
  var Cafe = require('../models/cafe').Cafe;
	var UniqueVisitor = require('../models/uniqueVisitors').UniqueVisitor;
	var Tools = require('../models/tool').Tools;
	var Products = require('../models/product').Products;
	var Geography = require('../models/geography').Geography;
	var Category = require('../models/category').Category;
	var UniqueVisitor = require('../models/uniqueVisitors').UniqueVisitor;
	var User = require('../models/user').User;
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

	this.getUserInfo = function(questionUserIds, callback) {
		User.find({_id : {$in: questionUserIds}}).lean().exec(function(err, userInfo){
			for(i in userInfo) userInfo[userInfo[i]._id] = userInfo[i];							
			callback(err, userInfo);
		});
	};

	this.removeHiddenAttributes = function(attributes){
		for(key in attributes) {
			if(attributes[key].hidden) delete attributes[key];
		}
		return attributes;
	};

	this.uniqueVisits = function(visitor){
    var model = undefined;
		if(visitor.type == 'media') model = Media;
		if(visitor.type == '12thcross') model =  TwelthCross;
		UniqueVisitor.findOne(visitor).lean().exec(function(err, log){
			if(log)
			{
				if(model != undefined) model.update({ urlSlug:visitor.urlSlug }, { $inc:{ views:1 } }, { upsert:true }).exec();
				UniqueVisitor.update(visitor, { $inc:{ views:1 } }, { upsert:true }).exec();
			}
			else
			{
				if(model != undefined) model.update({ urlSlug:visitor.urlSlug }, { $inc:{ views:1, uniqueViews:1 } }, { upsert:true }).exec();
				visitor.views = 1;
				var newVisitor = UniqueVisitor(visitor);
				newVisitor.save();
			}
		});
	};

	this.isNumber = function(n){
		return /^-?[\d.]+(?:e-?\d+)?$/.test(n);
	}

	this.capitalizeFirstLetter= function(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
	}

	this.humanReadable = function(str){
    returnString = str[0].toUpperCase();

    for(var i = 1; i < str.length; i++)
    {
      if(str[i] >= 'A' && str[i] <= 'Z')
      {
        returnString += ' ' + str[i];
      }
      else
      if(str[i] == '-' || str[i] == '_')
      {
        returnString += ' ';
      }
      else
      {
        returnString += str[i];
      }
    }
    return returnString;
	};

  this.addCommas = function(x){
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

};

module.exports.Common = new Common();
