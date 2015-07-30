
var mongoose = require('mongoose');

var tools = mongoose.model('tools', new mongoose.Schema({},{strict : false}));

module.exports = {Tools : tools};