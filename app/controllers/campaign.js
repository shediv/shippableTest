var Campaign = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Media = require('../models/media').Media;
  var nodeMailer = require('nodemailer');
  var SaveCampaigns = require('../models/saveCampaigns').SaveCampaigns;
  var jwt = require('jsonwebtoken');

  var xlReader = require('node-xlsx');
  var excelbuilder = require('msexcel-builder');
  var multer  = require('multer');
  var fs = require('fs');

  this.medias = {};
  this.config = require('../config/config.js');
  var self = this;

  this.transporter = nodeMailer.createTransport({
    service: self.config.smtpService,
    host: self.config.smtpHost,
    port: self.config.smtpPort,
    auth: self.config.smtpAuth
  });

  var path = require('path');
  var EmailTemplate = require('email-templates').EmailTemplate;
  var templatesDir = path.resolve(__dirname, '../..', 'public/templates/emailTemplates');

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
    // create a new campaign
    var newCampaign = SaveCampaigns(req.body);
    // save the campaign
    newCampaign.save(function(err) {
      if(err) return res.status(500).json(err);
      res.status(200).json("Campaign Created Successfully");
    });

    self.medias = req.body.bestRates;
    self.emailContent = [];
    self.excelContent = [];
    self.filename;
    self.path = [];
    async.each(Object.keys(self.medias), function(tool, callback){
      switch(tool)
      {
        case 'magazine':
          self.magazine(self.medias[tool], tool, callback);
          break;
        case 'newspaper':
          self.newspaper(self.medias[tool], tool, callback);
          break;
        case 'radio':
          self.radio(self.medias[tool], tool, callback);
          break;
        case 'television':
          self.television(self.medias[tool], tool, callback);
          break;
        case 'cinema':
          self.cinema(self.medias[tool], tool, callback);
          break;
        case 'airport':
          self.airport(self.medias[tool], tool, callback);
          break;
        case 'digital':
          self.digital(self.medias[tool], tool, callback);
          break;
        case 'outdoor':
          self.outdoor(self.medias[tool], tool, callback);
          break;
        case 'nontraditional':
          self.nontraditional(self.medias[tool], tool, callback);
          break;
        default:
          callback(null);
      }
    },function(err){
      if(err) return res.status(500).json(err);
      var token = req.body.token || req.query.token || req.headers['x-access-token'];

      res.status(200).json({email:self.emailContent,excel:self.excelContent});
      excelContent = self.createExcel(self.excelContent, token);

    });
  };

    self.magazine = function(data, tool, callback){
      tool = 'Magazine';
      unit = 'Insert(s)';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            switch(i)
            {
              case 'print':
              {
                for(k in data[id].selectedOptions[i])
                {
                  var option = {};
                  option.tool = tool + ' - Print';
                  option.name = data[id].name;
                  date = new Date(data[id].startDate);
                  var curr_month = date.getMonth() + 1;
                  option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
                  option.mediaOption = CommonLib.humanReadable(k);
                  option.campaignDetails = data[id].selectedOptions[i][k].qty + ' ' + unit;
                  if(data[id].selectedOptions[i][k].qty <= 2 && data[id].selectedOptions[i][k].qty >= 1)
                    option.totalPrice = data[id].selectedOptions[i][k].qty * data[id].selectedOptions[i][k]['1-2'];
                  if(data[id].selectedOptions[i][k].qty <= 6 && data[id].selectedOptions[i][k].qty >= 3)
                    option.totalPrice = data[id].selectedOptions[i][k].qty * data[id].selectedOptions[i][k]['3-6'];
                  if(data[id].selectedOptions[i][k].qty >= 7)
                    option.totalPrice = data[id].selectedOptions[i][k].qty * data[id].selectedOptions[i][k]['7+'];
                  option.totalPrice = 'Rs. ' + CommonLib.addCommas(option.totalPrice);
                  self.emailContent.push(option);
                }
                break;
              }
              default:
              {
                for(k in data[id].selectedOptions[i])
                {
                  var option = {};
                  option.tool = tool + ' - ' + CommonLib.humanReadable(i);
                  option.name = data[id].name;
                  option.mediaOption = CommonLib.humanReadable(k);
                  option.campaignDetails = data[id].selectedOptions[i][k].qty + ' ' + unit;
                  option.totalPrice = data[id].selectedOptions[i][k].qty * data[id].selectedOptions[i][k].pricing;
                  option.totalPrice = 'Rs. ' + CommonLib.addCommas(option.totalPrice);
                  self.emailContent.push(option);
                }
              }
            }
          }
        }
      }
      callback(null);
    };

    self.newspaper = function(data, tool, callback){
      tool = 'Newspaper';
      unit = 'Insert(s)';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            for(k in data[id].selectedOptions[i])
            {
              var option = {};
              option.tool = tool;
              option.name = data[id].name + ', ' + data[id].editionName + ', ' + data[id].areaCovered;
              date = new Date(data[id].startDate);
              var curr_month = date.getMonth() + 1;
              option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
              option.mediaOption = CommonLib.humanReadable(k);
              option.campaignDetails = data[id].selectedOptions[i][k].noOfInserts + ' ' + unit;
              option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions[i][k].totalPrice);
              self.emailContent.push(option);
            }
          }
        }
      }
      callback(null);
    };

    self.radio = function(data, tool, callback){
      tool = 'Radio';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            for(k in data[id].selectedOptions[i])
            {
              var option = {};
              option.tool = tool;
              option.name = data[id].station + ', ' + data[id].city;
              date = new Date(data[id].startDate);
              var curr_month = date.getMonth() + 1;
              option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
              if(i == 'rjOptions')
                option.mediaOption = 'RJ Mention - ' + data[id].selectedOptions[i][k].rjName + data[id].selectedOptions[i][k].showName;
              else
                option.mediaOption = CommonLib.humanReadable(k);

              if(i == 'regularOptions')
              {
                option.campaignDetails = data[id].selectedOptions[i][k].jingleLength + ' ' + data[id].selectedOptions[i][k].pricingUnit1;
                option.campaignDetails += '/' + data[id].selectedOptions[i][k].noOfTimes + ' ' + data[id].selectedOptions[i][k].pricingUnit2;
                option.campaignDetails += '/' + data[id].selectedOptions[i][k].noOfDays + ' ' + data[id].selectedOptions[i][k].pricingUnit3;
              }
              else
              {
                option.campaignDetails = data[id].selectedOptions[i][k].inputUnit1 + ' ' + data[id].selectedOptions[i][k].pricingUnit1;
                if(data[id].selectedOptions[i][k].pricingUnit2 != undefined)
                  option.campaignDetails += '/' + data[id].selectedOptions[i][k].inputUnit2 + ' ' + data[id].selectedOptions[i][k].pricingUnit2;
                if(data[id].selectedOptions[i][k].pricingUnit3 != undefined)
                  option.campaignDetails += '/' + data[id].selectedOptions[i][k].inputUnit3 + ' ' + data[id].selectedOptions[i][k].pricingUnit3;
              }
              option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions[i][k].totalPrice);
              self.emailContent.push(option);
            }
          }
        }
      }
      callback(null);
    };

    self.television = function(data, tool, callback){
      tool = 'Television';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            var option = {};
            option.tool = tool;
            option.name = data[id].name;
            date = new Date(data[id].startDate);
            var curr_month = date.getMonth() + 1;
            option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
            option.mediaOption = data[id].selectedOptions[i].time;

            option.campaignDetails = data[id].selectedOptions[i].adLength + ' Seconds';
            option.campaignDetails += '/' + data[id].selectedOptions[i].noOfTimes + ' Time(s)';
            option.campaignDetails += '/' + data[id].selectedOptions[i].noOfDays + ' Day(s)';

            option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions[i].totalPrice);
            self.emailContent.push(option);
          }
        }
      }
      callback(null);
    };

    self.cinema = function(data, tool, callback){
      tool = 'Cinema';

      for(type in data)
      {
        if(type == 'onScreen')
        {
          for(i in data[type])
          {
            var option = {};
            option.tool = tool + ' - On Screen';
            option.name = 'Cinema Plan - ' + parseInt( parseInt(i)+1);            
            option.mediaOption = CommonLib.humanReadable(data[type][i].selectedOption);
            option.campaignDetails = data[type][i].noOfWeeks + ' Week(s)';
            option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[type][i].totalPrice);
            date = new Date(data[type][i].startDate);
            var curr_month = date.getMonth() + 1;
            option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();                      
            self.emailContent.push(option);

            var option = [];
            for(k in data[type][i].screens)
            {
              var screens = {};
              screens.city = data[type][i].screens[k].city;
              screens.mallName = data[type][i].screens[k].resultMallName;
              screens.screenNumber = data[type][i].screens[k].screenNumber;
              screens.seats = data[type][i].screens[k].seats;
              screens.city = data[type][i].screens[k].city;
              screens.theatreName = data[type][i].screens[k].theatreName;

              key = Object.keys(data[type][i].screens[k].mediaOptions[data[type][i].selectedOption])[0];
              screens.weeklyRate = data[type][i].screens[k].mediaOptions[data[type][i].selectedOption][key].discountedRate;
              option.push(screens);
            }
            self.excelContent.push(option);
          }
        }
        if(type == 'offScreen')
        {
          tool += ' - Off Screen';
          for(id in data[type])
          {
            if(data[type][id].selectedOptions != undefined)
            {
              for(i in data[type][id].selectedOptions)
              {
                var option = {};
                option.tool = tool;
                option.name = data[type][id].cinemaChain + ' - ' + data[type][id].mallName;
                date = new Date(data[id].startDate);
                var curr_month = date.getMonth() + 1;
                option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
                option.mediaOption = CommonLib.humanReadable(i);

                option.campaignDetails = data[type][id].selectedOptions[i].inputUnit1 + ' ' + data[type][id].selectedOptions[i].pricingUnit1;
                if(data[type][id].selectedOptions[i].pricingUnit2 != undefined)
                  option.campaignDetails += '/' + data[type][id].selectedOptions[i].inputUnit2 + ' ' + data[type][id].selectedOptions[i].pricingUnit2;
                if(data[type][id].selectedOptions[i].pricingUnit3 != undefined)
                  option.campaignDetails += '/' + data[type][id].selectedOptions[i].inputUnit3 + ' ' + data[type][id].selectedOptions[i].pricingUnit3;

                option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[type][id].selectedOptions[i].totalPrice);
                self.emailContent.push(option);
              }
            }
          }
        }
      }
      callback(null);
    };

    self.airport = function(data, tool, callback){
      tool = 'Airort/Inflight';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            var option = {};
            option.tool = tool;
            option.name = data[id].name;            
            date = new Date(data[id].startDate);
            var curr_month = date.getMonth() + 1;
            option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
            option.mediaOption = data[id].selectedOptions[i].name;

            option.campaignDetails = data[id].selectedOptions[i].inputUnit1 + ' ' + data[id].selectedOptions[i].pricingUnit1;
            if(data[id].selectedOptions[i].pricingUnit2 != undefined)
              option.campaignDetails += '/' + data[id].selectedOptions[i].inputUnit2 + ' ' + data[id].selectedOptions[i].pricingUnit2;
            if(data[id].selectedOptions[i].pricingUnit3 != undefined)
              option.campaignDetails += '/' + data[id].selectedOptions[i].inputUnit3 + ' ' + data[id].selectedOptions[i].pricingUnit3;

            option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions[i].totalPrice);
            self.emailContent.push(option);
          }
        }
      }
      callback(null);
    };

    self.digital = function(data, tool, callback){
      tool = 'Digital';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            var option = {};
            option.tool = tool;
            option.name = data[id].name;
            date = new Date(data[id].startDate);
            var curr_month = date.getMonth() + 1;
            option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
            option.mediaOption = data[id].selectedOptions[i].name;

            option.campaignDetails = data[id].selectedOptions[i].inputUnit1 + ' ' + data[id].selectedOptions[i].pricingUnit1;
            if(data[id].selectedOptions[i].pricingUnit2 != undefined)
              option.campaignDetails += '/' + data[id].selectedOptions[i].inputUnit2 + ' ' + data[id].selectedOptions[i].pricingUnit2;
            if(data[id].selectedOptions[i].pricingUnit3 != undefined)
              option.campaignDetails += '/' + data[id].selectedOptions[i].inputUnit3 + ' ' + data[id].selectedOptions[i].pricingUnit3;

            option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions[i].totalPrice);
            self.emailContent.push(option);
          }
        }
      }
      callback(null);
    };

    self.outdoor = function(data, tool, callback){
      tool = 'Outdoor';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          var option = {};
          option.tool = tool;
          option.name = data[id].name;
          date = new Date(data[id].startDate);
          var curr_month = date.getMonth() + 1;
          option.startDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
          option.mediaOption = data[id].selectedOptions.mediaType;
          option.campaignDetails = data[id].selectedOptions.noOfMonths + ' Month(s)';
          option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions.totalPrice);
          self.emailContent.push(option);
        }
      }
      callback(null);
    };

    self.nontraditional = function(data, tool, callback){
      tool = 'Non Traditional';

      for(id in data)
      {
        if(data[id].selectedOptions != undefined)
        {
          for(i in data[id].selectedOptions)
          {
            var option = {};
            option.tool = tool;
            option.name = data[id].name;
            option.startDate = data[id].startDate;            
            option.mediaOption = data[id].selectedOptions[i].name;

            option.campaignDetails = data[id].selectedOptions[i].inputUnit1 + ' ' + data[id].selectedOptions[i].pricingUnit1;
            if(data[id].selectedOptions[i].pricingUnit2 != undefined)
              option.campaignDetails += '/' + data[id].selectedOptions[i].inputUnit2 + ' ' + data[id].selectedOptions[i].pricingUnit2;
            if(data[id].selectedOptions[i].pricingUnit3 != undefined)
              option.campaignDetails += '/' + data[id].selectedOptions[i].inputUnit3 + ' ' + data[id].selectedOptions[i].pricingUnit3;

            option.totalPrice = 'Rs. ' + CommonLib.addCommas(data[id].selectedOptions[i].totalPrice);
            self.emailContent.push(option);
          }
        }
      }
      callback(null);
    };

    self.sendEmail = function(data, token, filename, excelPath)
    {
      if(!token) console.log("No Token"); //res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) console.log("Invalid Token");
        var user = decoded;
        date = new Date();
        var curr_month = date.getMonth() + 1;
        var currentDate = date.getDate() + '/'+ curr_month + '/'+date.getFullYear();
        var mailOptions = {
          email: user.email,
          name: {
            first: CommonLib.capitalizeFirstLetter(user.firstName),
            last: CommonLib.capitalizeFirstLetter(user.lastName)
          },
          appHost: self.config.appHost,
          emailContent: data,
          currentDate : currentDate
        };            

        var attachments = [];
        for(i in excelPath){
          attachments.push({path : excelPath[i]});
        }

        var emailTemplate = new EmailTemplate(path.join(templatesDir, 'campaign'));

        emailTemplate.render(mailOptions, function(err, results){
          if(err) return console.error(err)
          self.transporter.sendMail({
            from: self.config.noreply, // sender address
            to: mailOptions.email, // list of receivers
            cc: "help@themediaant.com",
            subject: 'The Media Ant Campaign Saved - '+mailOptions.currentDate,
            html: results.html,
            attachments: attachments
          }, function(err, responseStatus){
            if(err) return console.log(err);
             console.log("responseStatus.message");
          })
        });
      });
    };

    self.createExcel = function(data, token)
    {
      //if(!data.length) self.sendEmail(self.emailContent, token, self.filename, self.path);
      async.each(data, function(media, callback){
        var length = parseInt(media.length);
        var path = 'public/bestRate';
        date = new Date();
        var file_name = 'cinema'+self.path.length+'.xlsx';
        self.filename = file_name;
        self.path.push(path+'/'+file_name);
        var workbook = excelbuilder.createWorkbook(path, file_name);
        // Create a new worksheet with 10 columns and 12 rows
        var sheet1 = workbook.createSheet('sheet1', 6, length+1);

        // Fill some data
        sheet1.set(1, 1, 'City');
        sheet1.set(2, 1, 'MallName/Locality');
        sheet1.set(3, 1, 'Theatre Name');
        sheet1.set(4, 1, 'Screen Number');
        sheet1.set(5, 1, 'Seats');
        sheet1.set(6, 1, 'Weekly Rate');

        for (var j = 0; j<media.length; j++){
              sheet1.set(1, j+2, media[j].city);
              sheet1.set(2, j+2, media[j].mallName);
              sheet1.set(3, j+2, media[j].theatreName);
              sheet1.set(4, j+2, media[j].screenNumber);
              sheet1.set(5, j+2, media[j].seats);
              sheet1.set(6, j+2, media[j].weeklyRate);
        }

        // Save it
        workbook.save(function(err){
          if (err) {
              workbook.cancel();
              //res.status(500).json(err);
              //return 0;
          }
          else {
              //res.status(200).json("success");
              //return 1;
          }

          callback(err);
        });
      },function(err){
        if(err) console.log("not able to create excel");
        self.sendEmail(self.emailContent, token, self.filename, self.path);
      });
    }
};

module.exports.Campaign = Campaign;
