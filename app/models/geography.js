
var mongoose = require('mongoose');

var geography = mongoose.model('geography', new mongoose.Schema({},{strict : false}), 'geography');

module.exports = { Geography : geography};