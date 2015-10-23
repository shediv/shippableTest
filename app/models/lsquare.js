
var mongoose = require('mongoose');

var lsquare = mongoose.model('lsquare', new mongoose.Schema({},{strict : false}), 'lsquares');

module.exports = { Lsquare : lsquare };

