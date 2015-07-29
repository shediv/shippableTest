
var functions = {};
var Media = require('../models/media').Media;
var Tools = require('../models/media').Tools;
var Products = require('../models/media').Products;

var toolId;

functions.getCategories = function(callback){
    Media.aggregate({$match: {toolId:toolId, isActive : 1}},{
        $group : {
            _id : { id :'$categoryId', name: '$name'},
            count : {$sum : 1}
        }
    }, function(error, results){
        for(var i = 0; i < results.length; i ++){
            results[i].name = results[i]._id.name;
            results[i]._id = results[i]._id.id;
        }
        callback(error, results);
    });
};

functions.getGeographies = function(callback){
    Media.aggregate({$match: {toolId:toolId, geography: { $exists: 1}, isActive : 1}}, {
        $unwind: '$geography'
    }, {
        $group : {
            _id : '$geography'
        }
    }, function(error, results){
        callback(error, results);
    });
};

functions.getLanguages = function(callback){
    Media.aggregate({$match: {toolId:toolId, "attributes.language.value": { $exists: 1}, isActive : 1}},{
        $group : {
            _id : '$attributes.language.value',
            count : {$sum : 1}
        }
    }, function(error, results){
        callback(error, results);
    });
};

functions.getTargetGroups = function(callback){
    Media.aggregate({$match: {toolId:toolId, targetGroup: { $exists: 1}, isActive : 1}}, {
        $unwind: '$targetGroup'
    }, {
        $group : {
            _id : '$targetGroup',
            count : {$sum : 1}
        }
    }, function(error, results){
        callback(error, results);
    });
};

functions.getFrequencies = function(callback){
    Media.aggregate({$match: {toolId:toolId, "attributes.frequency": { $exists: 1}, isActive : 1}},{
        $group : {
            _id : '$attributes.frequency.value',
            count : {$sum : 1}
        }
    }, function(error, results){
        callback(error, results);
    });
};

functions.getMediaOptions = function(callback){
    //Hardcoding the values for now, as the frequency of changes is very low
    var mediaOptions = [
        {'_id' : 'print', 'name' : 'Print'},
        {'_id' : 'eMail', 'name' : 'EMail'},
        {'_id' : 'website', 'name' : 'Website'}
    ];
    callback(null, mediaOptions);
};

functions.getProducts = function(callback){
    Products.find({}, '_id name', function(error, results){
        callback(error, results);
    });
};

functions.getToolId = function(toolName, setToolId, callback){
    Tools.findOne({name: toolName}, function(err, result){
        if(setToolId) toolId = result._id.toString();
        callback(err, result);
    });
};

module.exports = functions;