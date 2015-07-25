/**
 * Created by srujan on 1/18/15.
 */

var mongoose = require('mongoose');

var MediaSchema = new mongoose.Schema({
    "toolId" : {type: String},
    "categoryId" : {type: String},
    "name" : {type: String},
    "targetGroups" : [],
    "tabs" : [],
    "attributes" : {},
    "sections" : [],
    "mediaOptions" : {},
    "artWorkFormats" : [],
    "timeline" : {},
    "thumbnail" : {type: String},
    "imageUrl" : {type: String},
    "urlSlug" : {type: String},
    "createdAt" : {type: Date, default:Date.now},
    "createdBy" : {type: String},
    "isActive" : {type: Number},
    "views" : {type: Number},
    "eliminators" : {},
    "keywords" : [],
    "geography" : []
});

var media = mongoose.model('medias', MediaSchema);
module.exports = { Media: media };
