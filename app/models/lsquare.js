
var mongoose = require('mongoose');

var lsquare = mongoose.model('lsquare', new mongoose.Schema({},{strict : false}), 'lsquare');

module.exports = { Lsquare : lsquare};