
var mongoose = require('mongoose');

var lsquareAnswerScore = mongoose.model('lsquareAnswerScore', new mongoose.Schema({},{strict : false}), 'lsquareAnswerScores');

module.exports = { LsquareAnswerScore : lsquareAnswerScore};