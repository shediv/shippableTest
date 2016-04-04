var User = function()
{
	var async = require('async');
	var jwt = require('jsonwebtoken');
	var fs = require('fs');
	var mkdirp = require('mkdirp');
	var crypto =require('crypto');

	var path = require('path');

	//.................
	var github = require('octonode');
	var client = github.client();

	var ghme           = client.me();
	var ghuser         = client.user('pksunkara');
	var ghrepo         = client.repo('pksunkara/octonode');
	var ghsearch = client.search();

	//.....................
	this.params = {};
	var self = this;

	this.check = function(req, res){
		var ghrepo = client.repo(req.query.urlSlug);
		ghrepo.issues(function (err, status, body, headers) {
  		//return res.status(200).json({status : status, count : status.length})
  		var last24hoursData = [];
  		var last7daysData = [];
  		var above7daysData = [];
  		for(i in status){
  			if(self.last24hours(status[i].created_at)){
  				last24hoursData = last24hoursData.concat(status[i])
  			}
  			else if(self.last7days(status[i].created_at)){
  				last7daysData = last7daysData.concat(status[i])
  			}
  			else if(self.above7days(status[i].created_at)){
  				above7daysData = above7daysData.concat(status[i])
  			}
  		}

			return res.status(200).json({last24hoursData : last24hoursData, last24hoursDataCount : last24hoursData.length, last7daysData : last7daysData, last7daysDataCount : last7daysData.length, above7daysData : above7daysData, above7daysDataCount : above7daysData.length, count : status.length})  		
		});	
	};

	this.last24hours = function(datetime){
		var before = new Date(datetime),
    now = new Date();
    return ( ( now - before ) < ( 1000 * 60 * 60 * 24 )  ) ? true : false;
	}

	this.last7days = function(datetime){
		var before = new Date(datetime),
    now = new Date();
    return ( ( now - before ) < ( 1000 * 60 * 60 * 24 * 7)  ) ? true : false;
	}

	this.above7days = function(datetime){
		var before = new Date(datetime),
    now = new Date();
    return ( ( now - before ) > ( 1000 * 60 * 60 * 24 * 7)  ) ? true : false;
	}


}

module.exports.User = User;
