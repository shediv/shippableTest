
var mongoose = require('mongoose');

var user = mongoose.model('users', new mongoose.Schema({
    email : {type: String},
    password : {type: String}
},{strict : false}));

module.exports = { User: user};
