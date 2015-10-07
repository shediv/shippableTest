
var mongoose = require('mongoose');

var subCategory = mongoose.model('subCategory', new mongoose.Schema({},{strict : false}), 'subCategories');

module.exports = { SubCategory : subCategory };