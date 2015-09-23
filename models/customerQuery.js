
var mongoose = require('mongoose');

var customerQuery = mongoose.model('customerQueries', new mongoose.Schema({},{strict : false}), 'customerQueries');

module.exports = { CustomerQuery : customerQuery};