/**
 * Created by srujan on 1/18/15.
 */

var mongoose = require('mongoose');

var CategorySchema = new mongoose.Schema({
    "name" : {type: String},
    "isActive" : {type: Number}
});

var category = mongoose.model('categories', CategorySchema);
module.exports = { Category: category };
