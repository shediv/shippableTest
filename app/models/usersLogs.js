
var mongoose = require('mongoose');

var usersLogs = mongoose.model('usersLogs', new mongoose.Schema({},{strict : false}), 'usersLogs');

module.exports = { UsersLogs : usersLogs};