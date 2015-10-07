
var mongoose = require('mongoose');

var TwelthCross = mongoose.model('12thCross', new mongoose.Schema({},{strict : false}), '12thCross');

module.exports = { TwelthCross : TwelthCross};