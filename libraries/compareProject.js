var compareProject ={

	"magazine":{
	  '_id' : 1,
    'name' : 1,
    'urlSlug' : 1,
    'thumbnail' : 1,
    'targetGroup' : 1,
    'categoryId' : 1,
    'attributes.frequency.value' : 1,
    'attributes.language.value' : 1,
    'attributes.targetGroup' : 1,
    'attributes.readership.value' : 1,
    'attributes.circulation.value' : 1,
    'print.mediaOptions.fullPage.1-2' : 1,
    'IRS' : 1,
    'digital' : 1
	},

	"newspaper":{
	  '_id' : 1,
    'urlSlug' : 1,
    'name'       : 1,
    'editionName' : 1,
    'circulation' : 1,
    'areaCovered' : 1,
    'categoryId' :1,
    'language' : 1,
    'mediaOptions.anyPage.<800SqCms.cardRate' : 1,        
    'logo' : 1
	},

	"radio":{
	  '_id' : 1,
    'radioFrequency' : 1,
    'station' : 1,
    'urlSlug' : 1,
    'city' : 1,
    'language' : 1,
    'mediaOptions.regularOptions.allDayPlan.cardRate' : 1, 
    'logo' : 1
	},

	"outdoor":{
	  '_id' : 1,
    'urlSlug' : 1,
    'name' : 1,
    'landmark' : 1,
    'mediaType' : 1,
    'mediaOptions.ratePerSquareFeet' : 1,
    'mediaOptions.showRate' : 1,
    'geography' : 1,        
    'logo' : 1
	},

	"airport": {
		'_id' : 1,
    'name' : 1,
    'urlSlug' : 1,
    'thumbnail' : 1,
    'mediaOptions': 1
	},

	"digital": {
		'_id' : 1,
    'urlSlug' : 1,
    'name' : 1,
    'medium' : 1,
    'mediaOptions' : 1,
    'language' : 1,        
    'logo' : 1,
    'geoTagging' : 1,
    'reach1' : 1,
    'reach2' : 1,
    'unit1' : 1,
    'unit2' : 1,
    'categoryId' : 1
	}
}

module.exports = compareProject;