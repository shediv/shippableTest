var functions = {};
var async = require('async');

var Media = require('../models/media').Media;
var Tools = require('../models/tool').Tools;
var Products = require('../models/product').Products;
var Geography = require('../models/geography').Geography;
var Category = require('../models/category').Category;

var toolId;
var query = {};

functions.buildQuery = function(params, callback){
    query.sortBy = params.sortBy || 'views';
    query.offset = params.offset || 0;
    query.limit = params.limit || 9;
    query.match = {};
    var filters = {
        'categories' : 'categoryId',
        'geography' : 'geography',
        'languages' : 'attributes.language.value',
        'frequencies' : 'attributes.frequency.value',
        'targetGroups' : 'targetGroup'
    };
    query.projection = { '_id' : 1, 'attributes' : 1, 'urlSlug' : 1, 'thumbnail' : 1, 'categoryId' : 1, 'name' : 1,
        'mediaOptions.print.fullPage.1-2' : 1, 'toolId' : 1, 'createdBy' : 1};

    Object.keys(filters).map(function(value) {
        if(params.filters[value].length) {
            query.match[filters[value]] = {'$in': params.filters[value]};
        }
    });

    params.filters.mediaOptions.forEach(function(value, key){
        query.match['mediaOptions.'+value] = { $exists : 1};
    });
    query.match.isActive = 1;
    query.match.toolId = toolId;
    callback(null, query);
};

functions.search = function(callback){
    async.parallel({
        count: function(callbackInner){
            Media.aggregate({$match : query.match}, {$group: { _id : null, count: {$sum: 1}}}, function(err, result){
                callbackInner(err, result[0].count);
            });
        },
        magazines : function(callbackInner){
            switch(query.sortBy) {
                case 'views': query.sortBy = { 'views' : -1 }; break;
                case 'circulation': query.sortBy = { 'attributes.circulation.value' : -1}; break;
                case 'readership': query.sortBy = { 'attributes.readership.value' : -1}; break;
                case 'price': query.sortBy = { 'mediaOptions.print.fullPage.1-2' : -1}; break;
            }
            Media.aggregate({
                $match: query.match}, {$sort: query.sortBy}, {$skip : query.offset},{$limit: query.limit},{
                $project: query.projection}, function(err, results){
                callbackInner(err, results);
            });
        }
    }, function(err, results){
        callback(err, results);
    });
};

functions.getCategories = function(callback){
    Media.aggregate({$match: {toolId:toolId, isActive : 1}},{
        $group : {
            _id : '$categoryId',
            count : {$sum : 1}
        }
    }, function(error, results){
        var catIds = [];
        results.map(function(o){
            catIds.push(o._id);
        });
        Category.find({_id : {$in: catIds}},'name').lean().exec(function(err, cats){
            callback(error, cats);
        });
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
        var ids = [];
        for(var i =0; i < results.length; i++)
        ids.push(results[i]._id.toString());
        Geography.find({_id : {$in : ids}}, function(err, geos){
            callback(err, geos);
        });
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

functions.top3=function(callback){
    Media.aggregate({$match: query.match},{$project: query.projection},{
        $group: {_id: '$categoryId', medias: {$push : '$$ROOT'}}}, function(err, results){

            var medias =[];
            results.forEach(function(value, key){
                medias= medias.concat(yFormula(value));
            });
                var value= yFormula();
                console.log(value);

            /*console.log(medias);
            foreach ($grouped as $group)
            {
                $medias = array_merge($medias, $this->yFormula();
            }*/

            /*$data = array();
            $data['count'] = sizeof($medias);
            $data['magazines'] = array();
            $limit = $this->params->offset + $this->params->limit;
            if($limit > sizeof($medias)) $limit = sizeof($medias);
            for($i = $this->params->offset; $i < $limit; $i++) $data['magazines'][] = $medias[$i];
            print_r($data);
            die();
            return $data;*/

        callback(err, results);
    });
};


module.exports = functions;