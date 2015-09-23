/**
 * Created on 23/09/15.
 */

var express = require('express');
var router = express.Router();
var CustomerQueries = require('../models/customerQueries').Queries;

router.post("/", function(req ,res){
	
	var query = CustomerQueries(req.body);
		
	query.save(function(err,result){
		
		if(result)res.send(result);
	});

});


module.exports = router;