
var mongoose = require('mongoose');

var media = mongoose.model('medias', new mongoose.Schema({
    toolId : {type: String},
    categoryId : {type: String},
    views: {type: Number}
},{strict : false}));

module.exports = { Media: media};
