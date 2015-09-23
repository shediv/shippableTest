
var mongoose = require('mongoose');

var UniqueVisitors = mongoose.model('uniqueVisitors', new mongoose.Schema({},{strict : false}), 'uniqueVisitors');

module.exports = { UniqueVisitor : UniqueVisitors};