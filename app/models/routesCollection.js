var mongoose = require('mongoose');

var routesCollection = mongoose.model('routesCollection', new mongoose.Schema({},{strict : false}), 'routesCollections');

module.exports = { RoutesCollection : routesCollection};