
var mongoose = require('mongoose');

var contact = mongoose.model('contact', new mongoose.Schema({},{strict : false}), 'contact');

module.exports = { Contact : contact};