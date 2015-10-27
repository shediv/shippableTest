
var mongoose = require('mongoose');

var lsquareActivities = mongoose.model('lsquareActivities', new mongoose.Schema({},{strict : false}), 'lsquareActivities');

module.exports = { LsquareActivities : lsquareActivities};