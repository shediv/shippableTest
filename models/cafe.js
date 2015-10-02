
var mongoose = require('mongoose');

var cafe = mongoose.model('cafes', new mongoose.Schema({},{strict : false}));

module.exports = { Cafe: cafe};
