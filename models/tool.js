
var mongoose = require('mongoose');

var tools = mongoose.model('tools', new mongoose.Schema({
    name : {type: String}
},{strict : false}, 'tools'));

module.exports = {Tools : tools};