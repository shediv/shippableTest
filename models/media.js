
var mongoose = require('mongoose');

var media = mongoose.model('medias', new mongoose.Schema({
    categoryId : {type: String}
},{strict : false}));

module.exports = { Media: media};
