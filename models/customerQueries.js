
var mongoose = require('mongoose');

var queries = mongoose.model('queries', new mongoose.Schema({},{strict : false}), 'queries');

module.exports = { Queries : queries};