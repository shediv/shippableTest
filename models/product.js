/**
 * Created by srujan on 1/18/15.
 */

var mongoose = require('mongoose');

var ProductSchema = new mongoose.Schema({
    "name" : {type: String},
    "eliminators" : {},
    "keywords" : [],
    "magazineCategory" : [],
    "isActive" : {type: Number},
    "updated_at" : {type: Date, default:Date.now}
});

var product = mongoose.model('products', ProductSchema);
module.exports = { Product: product };
