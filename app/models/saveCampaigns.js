
var mongoose = require('mongoose');

var saveCampaigns = mongoose.model('saveCampaigns', new mongoose.Schema({},{strict : false}), 'saveCampaigns');

module.exports = { SaveCampaigns : saveCampaigns };