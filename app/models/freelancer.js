var mongoose = require('mongoose');

var freelancer = mongoose.model('freelancer', new mongoose.Schema({},{strict : false}), 'freelancers');

module.exports = { Freelancer : freelancer};