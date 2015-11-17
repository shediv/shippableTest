
var toolsProject= {

	"magazine": {
    "_id"        : 1,
		"urlSlug"    : 1,
    "categoryId" : 1,
    "attributes" : 1,
    "print" 		 : 1,
    "email"      : 1,
    "website"    : 1,
    "toolId"     : 1,
    "geography"  : 1,
    "thumbnail"  : 1,
    "keywords"   : 1,
    "IRS"        : 1,
    "createdBy"  : 1,
    "logo"       : 1,
    "name"       : 1,
    "views"      : 1,
    "serviceTaxPercentage" : 1
  },

	"newspaper": {
		'_id'           : 1,
    'urlSlug'       : 1,
    'name'          : 1,
    'editionName'   : 1,
    'areaCovered'   : 1,
    'circulation'   : 1,
    'language'      : 1,
    'geography'     : 1,
    'mediaOptions'  : 1,        
    'logo'          : 1,
    'dimensions'    : 1,
    "serviceTaxPercentage" : 1
	},

	"radio": {
		'_id' 					: 1,
    'urlSlug' 			: 1,
    'station' 			: 1,
    'geography' 		: 1,
    'language'  		: 1,
    'radioFrequency' : 1,
    'mediaOptions.regularOptions' : 1, 
    'logo' : 1,
    "serviceTaxPercentage" : 1
	},

	"television": {
		'_id'          : 1,
    'urlSlug'      : 1,
    'name'         : 1,
    'mediaOptions' : 1,
    'geography'    : 1,
    'language'     : 1,        
    'logo'         : 1,
    'categoryId'   : 1,
    'weeklyReach'  : 1,  
    "serviceTaxPercentage" : 1
	},

	"cinema": {
	 	'type' : 1,
    'mallName' : 1,
    'cinemaChain' : 1,
    'seats' : 1,
    'urlSlug' :1,
    'geography' : 1,
    'logo': 1,
    "serviceTaxPercentage" : 1
	},
		
	"outdoor": {
		'_id' : 1,
    'urlSlug' : 1,
    'uniqueId' : 1,
    'name' : 1,
    'mediaType' : 1,
    'mediaOptions' : 1,
    'geography' : 1,
    'size' : 1,        
    'logo' : 1,
    'litType' : 1,
    "serviceTaxPercentage" : 1
	},

	"airport": {
		'_id' : 1,
    'urlSlug' : 1,
    'name' : 1,
    'category' : 1,
    'mediaOptions' : 1,
    'geography' : 1,        
    'logo' : 1,
    "serviceTaxPercentage" : 1
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
    'categoryId' : 1,
    "serviceTaxPercentage" : 1
	},

	"nontraditional": {
		'_id'          : 1,
    'name'         : 1,
    'about'        : 1,
    'mediaOptions' : 1,
    'geography'    : 1,
    'urlSlug'      : 1,
    'logo'         : 1,
    "serviceTaxPercentage" : 1
	},

	"12thcross": {
		'_id'          : 1,
    'name'         : 1,
    'subCategoryId': 1,
    'geography'    : 1,
    'urlSlug'      : 1,
    'logo'         : 1,
    'cardRate'     : 1,
    'contact.primary.areasServiced' : 1
	},

  "lsquare": {
    '_id' : 1,
    'question' : 1,
    'description' : 1,
    'urlSlug' : 1,                
    'tags' : 1,
    'views' : 1,
    'createdAt' : 1,
    'active' : 1,
    'createdBy' : 1,
    'answers' : 1,
    'oldId' : 1
  }
}

module.exports = toolsProject;



