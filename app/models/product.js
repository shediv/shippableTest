var mongoose = require('mongoose');

var products = mongoose.model('products', new mongoose.Schema({},{strict : false}));

module.exports = { Products : products};
