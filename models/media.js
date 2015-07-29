/**
 * Created by srujan on 1/18/15.
 */

var mongoose = require('mongoose');

var media = mongoose.model('medias', new mongoose.Schema({categoryId : {type: String}},{strict : false}));
var tools = mongoose.model('tools', new mongoose.Schema({},{strict : false}));
module.exports = { Media: media, Tools : tools };