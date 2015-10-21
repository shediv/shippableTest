var mongoose = require('mongoose');

var lsquareAnswers = mongoose.model('lsquareAnswers', new mongoose.Schema({},{strict : false}), 'lsquareAnswers');

module.exports = { LsquareAnswers : lsquareAnswers};