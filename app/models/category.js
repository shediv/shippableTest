
var mongoose = require('mongoose');

var category = mongoose.model('category', new mongoose.Schema({},{strict : false}));

module.exports = { Category : category };