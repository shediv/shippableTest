
var mongoose = require('mongoose');

var upcomingMovies = mongoose.model('upcomingMovies', new mongoose.Schema({},{strict : false}), 'upcomingMovies');

module.exports = { UpcomingMovies : upcomingMovies};