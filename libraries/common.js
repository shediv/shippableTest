var Common = function()
{
	var Media = require('../models/media').Media;
	var TwelthCross = require('../models/12thCross').TwelthCross;
	var UniqueVisitor = require('../models/uniqueVisitors').UniqueVisitor;
	var Tools = require('../models/tool').Tools;
	var Products = require('../models/product').Products;
	var Geography = require('../models/geography').Geography;
	var Category = require('../models/category').Category;
	var UniqueVisitor = require('../models/uniqueVisitors').UniqueVisitor;
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

	this.uniqueVisits = function(visitor){
		if(visitor.type == 'media') var model = new Media;
		if(visitor.type == '12thcross') var model = new TwelthCross;
		UniqueVisitor.findOne(visitor).lean().exec(function(err, log){
			if(log)
			{
				Media.update({ urlSlug:visitor.urlSlug }, { $inc:{ views:1 } }, { upsert:true }).exec();
				UniqueVisitor.update(visitor, { $inc:{ views:1 } }, { upsert:true }).exec();
			}
			else
			{
				Media.update({ urlSlug:visitor.urlSlug }, { $inc:{ views:1, uniqueViews:1 } }, { upsert:true }).exec();
				visitor.views = 1;
				var newVisitor = UniqueVisitor(visitor);
				newVisitor.save();
			}
		});
	};

	this.isNumber = function(n){ 
		return /^-?[\d.]+(?:e-?\d+)?$/.test(n); 
	}

};

module.exports.Common = new Common();