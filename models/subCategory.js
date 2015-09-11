
var mongoose = require('mongoose');

var subCategory = mongoose.model('subCategory', new mongoose.Schema({},{strict : false}));

module.exports = { SubCategory : subCategory };