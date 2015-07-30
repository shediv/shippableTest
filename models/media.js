/**
 * Created by srujan on 1/18/15.
 */

var mongoose = require('mongoose');

var media = mongoose.model('medias', new mongoose.Schema({categoryId : {type: String}},{strict : false}));
var tools = mongoose.model('tools', new mongoose.Schema({},{strict : false}));
var products = mongoose.model('products', new mongoose.Schema({},{strict : false}));
var geography = mongoose.model('geography', new mongoose.Schema({},{strict : false}));
module.exports = { Media: media, Tools : tools, Products : products, Geography : geography };