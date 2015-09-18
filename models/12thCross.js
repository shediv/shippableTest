
var mongoose = require('mongoose');

var model12thCross = mongoose.model('12thCross', new mongoose.Schema({},{strict : false}), '12thCross');

module.exports = { Model12thCross : model12thCross};