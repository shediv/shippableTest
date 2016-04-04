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
  		return res.status(200).json({status : status, count : status.length})
		});	
	};
}

module.exports.User = User;
