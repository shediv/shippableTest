/**
 * Created by srujan on 1/18/15.
 */

var mongoose = require('mongoose');

var MediaSchema = new mongoose.Schema({
}, {strict : false});

var media = mongoose.model('medias', MediaSchema);
module.exports = { Media: media };
