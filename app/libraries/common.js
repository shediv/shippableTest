var Common = function()
{
	var Media = require('../models/media').Media;
	var TwelthCross = require('../models/12thCross').TwelthCross;
	var Lsquare = require('../models/lsquare').Lsquare;
  	var Cafe = require('../models/cafe').Cafe;
	var UniqueVisitor = require('../models/uniqueVisitors').UniqueVisitor;
	var Tools = require('../models/tool').Tools;
	var Products = require('../models/product').Products;
	var Geography = require('../models/geography').Geography;
	var Category = require('../models/category').Category;
	var UniqueVisitor = require('../models/uniqueVisitors').UniqueVisitor;
	var User = require('../models/user').User;
	var LsquareAnswerScore = require('../models/lsquareAnswerScore').LsquareAnswerScore;
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
			for(i in userInfo) {
				delete userInfo[i].password;
		        delete userInfo[i].dateofBirth;
		        delete userInfo[i].dateofJoin;
		        delete userInfo[i].oldId;
			}
			for(i in userInfo) userInfo[userInfo[i]._id] = userInfo[i];							
			callback(err, userInfo);
		});
	};

	this.checkLoginUserVote = function(answerIDs, userID, callback) {
		LsquareAnswerScore.find({userId:userID, answerId: {$in: answerIDs} }).lean().exec(function(err, loginUserVoteInfo){																
			for(i in loginUserVoteInfo) loginUserVoteInfo[loginUserVoteInfo[i].answerId] = true;			
			callback(err, loginUserVoteInfo);
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
		if(visitor.type == 'lsquare') model =  Lsquare;
		//For cafe 
		if(visitor.type == 'cafe') {
			model =  Cafe;
			UniqueVisitor.findOne(visitor).lean().exec(function(err, log){
				if(log)
				{
					if(model != undefined) model.update({ _id:visitor._id }, { $inc:{ views:1 } }).exec();
					UniqueVisitor.update(visitor, { $inc:{ views:1 } }, { upsert:true }).exec();
				}
				else
				{
					if(model != undefined) model.update({ _id:visitor._id }, { $inc:{ views:1, uniqueViews:1 } }).exec();
					visitor.views = 1;
					var newVisitor = UniqueVisitor(visitor);
					newVisitor.save();
				}
			});	
		}
		UniqueVisitor.findOne(visitor).lean().exec(function(err, log){
			if(log)
			{
				if(model != undefined) model.update({ urlSlug:visitor.urlSlug }, { $inc:{ views:1 } }).exec();
				UniqueVisitor.update(visitor, { $inc:{ views:1 } }, { upsert:true }).exec();
			}
			else
			{
				if(model != undefined) model.update({ urlSlug:visitor.urlSlug }, { $inc:{ views:1, uniqueViews:1 } }).exec();
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

	this.formMediaName = function(media, toolName){
		switch(toolName)
		{
			case 'cinema':
        if(media.type == 'onScreen')
        {
          media.name = media.theatreName + ', ' + media.resultMallName;
          delete media.theatreName;
          delete media.resultMallName;
        }
        else
        {
          media.name = media.cinemaChain + ', ' + media.mallName;
        }
        delete media.mallName;
        delete media.cinemaChain;
        delete media.type;
        break;
      case 'radio':
        media.name = media.station + ', ' + media.city;
        delete media.station;
        delete media.city;
        break;
      case 'newspaper':
        media.name = media.name + ', ' + media.editionName;
        media.name = media.name + ', ' + media.areaCovered;
        delete media.areaCovered;
        delete media.editionName;
        break;
      case 'digital':
        media.name = media.name + ', ' + media.medium;
        delete media.medium;
        break;
		}
		return media;
	};

  this.addCommas = function(x){
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

};

module.exports.Common = new Common();
