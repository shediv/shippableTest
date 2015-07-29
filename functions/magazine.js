
var functions = {};
var Media = require('../models/media').Media;
var Tools = require('../models/media').Tools;

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

functions.getToolId = function(toolName, setToolId, callback){
    Tools.findOne({name: toolName}, function(err, result){
        if(setToolId) toolId = result._id.toString();
        callback(err, result);
    });
};

functions.printToolId = function(){
    console.log(toolId);
    return;
};

module.exports = functions;