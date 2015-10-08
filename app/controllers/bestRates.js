var BestRates = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  
  this.medias = {};
  var self = this;

  this.getBestRates = function(req, res){
    self.medias = req.body.medias;
    async.each(Object.keys(self.medias), function(tool, callback){
      switch(tool)
      {
        case 'magazine':
          self.magazineBestRates(self.medias[tool], tool, callback);
          break;
        default:
          callback(null);
      }
    },function(err){
      if(err) return res.status(500).json(err);
      res.status(200).json({bestRates:self.medias});
    });
  };

  self.magazineBestRates = function(medias, tool, callback){
    var mediaIds = [];
    for(key in medias) mediaIds.push(key);

    Media.find({_id : {$in : mediaIds}}).lean().exec(function(err, result){
      totalGrossPrice = 0;
      totalGrossSaving = 0;
      result.map(function(media){ 
        for(key in medias[media._id].selectedOptions)
        {
          switch(key)
          {
            case 'print':
              for(mo in medias[media._id].selectedOptions.print)
              {
                medias[media._id].selectedOptions[key][mo].originalUnitPrice = media.print.mediaOptions[mo].cardRate;

                switch(true)
                {
                  case medias[media._id].selectedOptions.print[mo].qty <= 2:
                    medias[media._id].selectedOptions[key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['1-2'];   
                    break;
                  case medias[media._id].selectedOptions.print[mo].qty <= 6:
                    medias[media._id].selectedOptions[key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['3-6'];   
                    break;
                  case medias[media._id].selectedOptions.print[mo].qty > 6:
                    medias[media._id].selectedOptions[key][mo].discountedUnitPrice = media.print.mediaOptions[mo]['7+'];   
                    break;
                }
                
                medias[media._id].selectedOptions[key][mo].originalGrossPrice = medias[media._id].selectedOptions[key][mo].originalUnitPrice * medias[media._id].selectedOptions[key][mo].qty;
                medias[media._id].selectedOptions[key][mo].discountedGrossPrice = medias[media._id].selectedOptions[key][mo].discountedUnitPrice * medias[media._id].selectedOptions[key][mo].qty;
                medias[media._id].selectedOptions[key][mo].unitSaving = medias[media._id].selectedOptions[key][mo].originalUnitPrice - medias[media._id].selectedOptions[key][mo].discountedUnitPrice;
                medias[media._id].selectedOptions[key][mo].grossSaving = medias[media._id].selectedOptions[key][mo].originalGrossPrice - medias[media._id].selectedOptions[key][mo].discountedGrossPrice;
                totalGrossPrice = totalGrossPrice + medias[media._id].selectedOptions[key][mo].discountedGrossPrice;
                totalGrossSaving = totalGrossSaving + medias[media._id].selectedOptions[key][mo].grossSaving;
              }
              break;
            default:
              for(mo in medias[media._id].selectedOptions[key])
              {
                medias[media._id].selectedOptions[key][mo].originalUnitPrice = media[key].mediaOptions[mo].pricing;
                medias[media._id].selectedOptions[key][mo].dicsountedUnitPrice = media[key].mediaOptions[mo].pricing;
                medias[media._id].selectedOptions[key][mo].originalGrossPrice = medias[media._id].selectedOptions[key][mo].originalUnitPrice * medias[media._id].selectedOptions[key][mo].qty;
                medias[media._id].selectedOptions[key][mo].discountedGrossPrice = medias[media._id].selectedOptions[key][mo].dicsountedUnitPrice * medias[media._id].selectedOptions[key][mo].qty;
                medias[media._id].selectedOptions[key][mo].unitSaving = medias[media._id].selectedOptions[key][mo].originalUnitPrice , medias[media._id].selectedOptions[key][mo].discountedUnitPrice;
                medias[media._id].selectedOptions[key][mo].grossSaving = medias[media._id].selectedOptions[key][mo].originalGrossPrice - medias[media._id].selectedOptions[key][mo].discountedGrossPrice;
                totalGrossPrice = totalGrossPrice + medias[media._id].selectedOptions[key][mo].discountedGrossPrice;
                totalGrossSaving = totalGrossSaving + medias[media._id].selectedOptions[key][mo].grossSaving;
              }
          }
        }
        //medias[media._id].dates = self.getTenDates(media.timeline.dates, media.attributes.frequency.value);
      });
      self.medias[tool] = medias;
      self.medias[tool].totalGrossSaving = totalGrossSaving;
      self.medias[tool].totalGrossPrice = totalGrossPrice;
      callback(err)
    });
  }

  this.emailBestRates = function(req, res){
    self.medias = req.body.medias;
    async.each(Object.keys(self.medias), function(tool, callback){
      switch(tool)
      {
        case 'magazine':
          self.magazineEmailContent(self.medias[tool], tool, callback);
          break;
        case 'newspaper':
          self.newspaperEmailContent(self.medias[tool], tool, callback);
          break;
        case 'radio':
          self.radioEmailContent(self.medias[tool], tool, callback);
          break;
        case 'cinema':
          self.cinemaEmailContent(self.medias[tool], tool, callback);
          break;
        case 'airport':
          self.airportEmailContent(self.medias[tool], tool, callback);
          break;
        case 'digital':
          self.digitalEmailContent(self.medias[tool], tool, callback);
          break;
        case 'outdoor':
          self.outdoorEmailContent(self.medias[tool], tool, callback);
          break;
        case 'nontraditional':
          self.nontraditionalEmailContent(self.medias[tool], tool, callback);
          break;
        default:
          callback(null);
      }
    },function(err){
      if(err) return res.status(500).json(err);
      res.status(200).json({bestRates:self.medias});
    });
  };
};

module.exports.BestRates = BestRates;