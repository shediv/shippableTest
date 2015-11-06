var Lsquare = function()
{
  var async = require('async');
  var CommonLib = require('../libraries/common').Common;
  var Lsquare = require('../models/lsquare').Lsquare;
  var LsquareAnswer = require('../models/lsquareAnswers').LsquareAnswers;
  var User = require('../models/user').User;
  var jwt = require('jsonwebtoken');
  var underscore = require('underscore');
  var LsquareActivities = require('../models/lsquareActivities').LsquareActivities;
  var nodeMailer = require('nodemailer');
  var multer = require('multer');
  var imagick = require('imagemagick');
  var path = require('path');
  var EmailTemplate = require('email-templates').EmailTemplate;
  var templatesDir = path.resolve(__dirname, '../..', 'public/templates/emailTemplates');
  var ToolsProject = require('../config/toolsProject.js');
  var SearchIgnore = require('../config/searchignore.js');
  
  this.params = {};
  var self = this;
  var fs = require('fs');
  var path = require('path');

  this.params = {};
  this.config = require('../config/config.js');

  this.transporter = nodeMailer.createTransport({
    service: self.config.smtpService,
    host: self.config.smtpHost,
    port: self.config.smtpPort,
    auth: self.config.smtpAuth
  });

  this.getLsquare = function(req, res){
    self.params = JSON.parse(req.query.params);
    //return res.status(200).json(self.params);  
    async.waterfall([
      function(callback)
      {
        callback(null, self.applyFilters());
      },
      function(query, callback)
      {
        self.sortFilteredMedia(query, callback);
      }
    ],
    function (err, result)
    {
      if(err) return res.status(500).json(err);      
      res.status(200).json(result);
    });
  };

    self.applyFilters = function(){
      var query = {};
      query.sortBy = self.params.sortBy || 'createdAt';
      query.offset = self.params.offset || 0;
      query.limit = self.params.limit || 9;
      query.match = {};

      query.projection = ToolsProject.lsquare;

      if(self.params.filters.topics.length) query.match['tags'] = { $all:self.params.filters.topics };
      if(self.params.filters.askedBy.length) query.match['createdBy'] = { $in:self.params.filters.askedBy };
      query.match.active = 1;
      //query.match.toolId = self.toolId;
      return query;
    };

    self.sortFilteredMedia = function(query, callback){      
      var data = [];
      var user = []; 
      async.parallel({
        count : function(callbackInner)
        {          
          Lsquare.aggregate(
            {$match : query.match},
            {$group: { _id : "urlSlug", count: {$sum: 1} }},
            function(err, result)
            {
              if(result[0] === undefined) count = 0;
              else count = result[0].count;
              callbackInner(err, count);
            }
          );
        },
        questions : function(callbackInner)
        { 
          switch(query.sortBy)
          {
            case 'views': query.sortBy = { 'views' : -1 }; break;            
            case 'createdAt': query.sortBy = { 'createdAt' : -1 }; break;
          }
          query.sortBy._id = 1;
          Lsquare.aggregate(
            {$match: query.match}, {$sort: query.sortBy},
            {$skip : query.offset}, {$limit: query.limit},
            {$project: query.projection}, 
            function(err, results) 
            {              
              self.getQuestionAnswers(results, callbackInner);                            
            }
          );
        }
      },
      function(err, results) 
      {                                           
        callback(err, results);
      });
    };

    self.getQuestionAnswers = function(results, callbackInner){     
      var answerUsersIDs = [];        
      async.each(results, function(result, callbackEach){            
        User.findOne({_id : result.createdBy}).lean().exec(function(err,userInfo){
          result.createdBy = userInfo;
          LsquareAnswer.find({questionID : result._id.toString()}).lean().exec(function(err, answers){
           for(i in answers) answerUsersIDs.push(answers[i].answered_by)
           CommonLib.getUserInfo(answerUsersIDs, function(err, userInfo){
            for(i in answers) { answers[i].answered_by = userInfo[answers[i].answered_by];}
            result.answers = answers;
            result.answersCount = answers.length;
            callbackEach(null); 
           });         
          })        
        });            
      }, 
      function(err){
        if(self.params.sortBy == 'noOfAnswers') {
          results.sort(function(a,b){ return a.answersCount < b.answersCount }); }
        callbackInner(err, results);
      });                  
    };

    self.imageUpload = function(req, res){

      var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else
        { 
          var tmp_path = req.file.path;        
          var date = new Date();
          var returnPath = date + req.file.originalname;
          var path = './public/lsquare/'+ decoded._id;

          if (!fs.existsSync(path)){
              fs.mkdirSync(path);
          }

          var target_path = path + '/' + returnPath;

          /** A better way to copy the uploaded file. **/
          var src = fs.createReadStream(tmp_path);
          var dest = fs.createWriteStream(target_path);
          src.pipe(dest);

          html = "";
          html += "<script type='text/javascript'>";
          //html += "    var funcNum = " + req.query.CKEditorFuncNum + ";";
          html += "    var url     = \"/lsquare/"+ decoded._id + '/' +returnPath + "\";";
          html += "    var message = \"Uploaded file successfully\";";
          html += "";
          html += "    window.parent.CKEDITOR.tools.callFunction(funcNum, url, message);";
          html += "</script>";

          fs.unlinkSync(tmp_path);

          res.send(html);
        }  
      });      
    }

    this.getImages = function(req, res){
      var token = req.body.token || req.query.token || req.headers['x-access-token'];
        if(!token) return res.status(401).json("Token not found");
        jwt.verify(token, self.config.secret, function(err, decoded){
          if(err) res.status(401).json("Invalid Token");
          else
          {           
            var path = './public/lsquare/'+ decoded._id;
            var files = [];
            var i;

            fs.readdir(path, function (err, list) {
              for(i=0; i<list.length; i++) {
                  //if(path.extname(list[i]) === fileType) {
                      files.push('/lsquare/'+ decoded._id+'/'+list[i]); //store the file name into the array files
                  //}
              }
              res.status(200).json({images:files});
            });
          }            
        });
    };

  this.getFilters = function(req, res){
    async.parallel({
      //trendingQuestions : self.getTrendingQuestions,
      topics : self.getTopTags
    },
    function(err, results) 
    {
      if(err) return res.status(500).json(err);
      res.status(200).json({filters:results});
    });
  };

    self.getTrendingQuestions = function(callback){
      Lsquare.aggregate(
        {$match: {active : 1}},
        {$sort: {"views": -1}},
        {$limit : 8 },
        function(error, results) 
        {
          callback(error, results);
        }
      );
    };

    self.getTopTags = function(callback){
        Lsquare.aggregate(
          {$match: {active : 1}},
          {$sort: {"views": -1} },
          {$limit : 8 },        
          function(error, results) 
          {
            var Tags = [];
            for(i in results)
              for(j in results[i].tags){
                Tags.push(results[i].tags[j]);
              }
            var Tags = underscore.uniq(Tags);                  
            callback(error, Tags);
          }
        );
    };

  this.addQuestion = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else {                  
            var question = {};
            var url = req.body.question;
            // convert spaces to '-'
            url = url.replace(/ /g, "-");
            // Make lowercase
            url = url.toLowerCase();
            // Remove characters that are not alphanumeric or a '-'
            url = url.replace(/[^a-z0-9-]/g, "");
            // Combine multiple dashes (i.e., '---') into one dash '-'.
            url = url.replace(/[-]+/g, "-");

            question.createdBy = decoded._id;
            question.urlSlug = url;
            question.question = req.body.question;
            question.description = req.body.description;          
            question.tags = req.body.tags;
            question.createdAt = Date();
            question.editedAt = Date();
            question.views = 0;
            question.active = 1; 
            //return  res.status(200).json(question);
            var newQuestion = Lsquare(question);
            newQuestion.save(function(err){
              if(err) return res.status(500).json(err);
              res.status(200).json({newQuestion:newQuestion._id});

              var mailOptions = {};
              mailOptions.social = false;
              mailOptions.to = "videsh@themediaant.com";
              mailOptions.question = req.body.question;
              mailOptions.urlSlug = url;
              mailOptions.activity =  'New Question';
              mailOptions.appHost = self.config.appHost;
              mailOptions.date = Date();
              mailOptions.askedBy = decoded;
              if(decoded.googleId || decoded.facebookId) mailOptions.social = true;                
              var newActivity = LsquareActivities(mailOptions);

              newActivity.save(function(err){
                if(err) return res.status(500).json(err);
                if(req.body.assistance){
                  var emailTemplate = new EmailTemplate(path.join(templatesDir, 'newQuestion'));
                  emailTemplate.render(mailOptions, function(err, results){            
                    if(err) return console.error(err)
                    self.transporter.sendMail({
                    from: "help@themediaant.com", // sender address
                    to: mailOptions.to, // list of receivers
                    subject: 'LSquare - New Question',
                    html: results.html
                    }, function(err, responseStatus){
                    if(err) return console.error(err);
                     console.log("sucess");
                    })
                  });
                }
              });              
            });          
          }          
        });            
  };

  this.addAnswer = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else {
          var answer = {};
          answer = req.body.answer;
          answer.createdAt = Date();
          answer.answered_by = decoded._id;
          answer.questionID = req.body.answer.questionID;
          answer.score = 0;
          answer.active = 1;
          //return res.status(200).json(answer);
          var newAnswer = LsquareAnswer(answer);
          newAnswer.save(function(err){
            if (err) return res.send(500, { error: err });            
            res.status(200).json(newAnswer._id);
            Lsquare.findOne({_id: req.body.answer.questionID}).lean().exec(function(err, question){               
              User.findOne({_id : question.createdBy}).lean().exec(function(err,userInfo){
                //send mail to creator of question...                
                var mailOptions = {};
                mailOptions.social = false;
                mailOptions.to = userInfo.email;
                mailOptions.questionID = req.body.answer.questionID;
                mailOptions.activity =  'New Answer for a Question';
                mailOptions.answerID =  newAnswer._id;
                mailOptions.appHost = self.config.appHost;
                mailOptions.date = Date();
                var firstName = userInfo.firstName;
                firstName = firstName.substring(0,1).toUpperCase() + firstName.substring(1);
                mailOptions.name = firstName;
                mailOptions.answerBy = decoded;
                if(decoded.googleId || decoded.facebookId) mailOptions.social = true;               
                mailOptions.urlSlug = question.urlSlug;
                var newActivity = LsquareActivities(mailOptions);                

                newActivity.save(function(err){
                  if(err) return res.status(500).json(err);
                  var emailTemplate = new EmailTemplate(path.join(templatesDir, 'newAnswer'));
                  emailTemplate.render(mailOptions, function(err, results){            
                    if(err) return console.error(err)
                    self.transporter.sendMail({
                      from: "help@themediaant.com", // sender address
                      to: mailOptions.to, // list of receivers
                      subject: 'LSquare - New Answer for your Question',
                      html: results.html
                    }, function(err, responseStatus){
                      if(err) return console.error(err);
                       console.log("sucess");
                    })
                  });
                });                
              })               
            });
          });          
          }          
      });
  };

  this.userActivities = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if(!token) return res.status(401).json("Token not found");
    jwt.verify(token, self.config.secret, function(err, decoded){
      if(err) res.status(401).json("Invalid Token");
      else
      {  
        async.parallel({
          questions : function(callbackInner)
          {          
            Lsquare.find({createdBy : req.query.userID}).lean().exec(function(err, questions){
                callbackInner(err, questions);
              })
          },
          answers : function(callbackInner)
          { 
            LsquareAnswer.find({answered_by : req.query.userID}).lean().exec(function(err, results){
                self.getAnswersQuestion(results, callbackInner);
              })
          }
        },
        function(err, results) 
        {                                           
          var activities = [];
          for(i in results.questions){
            results.questions[i].type = 'question';
            activities.push(results.questions[i]);            
          }

          for(i in results.answers){            
            results.answers[i].type = 'answer';
            activities.push(results.answers[i]);
          }   
          res.status(200).json(activities);
        });
      }  
    })
  }

  self.getAnswersQuestion = function(results, callbackInner){     
      var answerUsersIDs = [];        
      async.each(results, function(result, callbackEach){            
        Lsquare.findOne({_id : result.questionID}).lean().exec(function(err,questions){
          result.question = questions;         
          callbackEach(null);                
        });            
      }, 
      function(err){
        //console.log(results);
        callbackInner(err, results);
      });                  
  };

  this.upvoteAnswer = function(req, res){
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
      if(!token) return res.status(401).json("Token not found");
      jwt.verify(token, self.config.secret, function(err, decoded){
        if(err) res.status(401).json("Invalid Token");
        else {
          LsquareAnswer.update({ _id:req.body.answerID }, { $inc:{ score:1 } }, { upsert:true }).exec();        
          res.status(200).json("sucess");
          Lsquare.findOne({_id: req.body.questionID}).lean().exec(function(err, question){
            LsquareAnswer.findOne({_id: req.body.answerID}).lean().exec(function(err, answer){
              User.findOne({_id: answer.answered_by}).lean().exec(function(err, user){
                var mailOptions = {};
                mailOptions.social = false;
                mailOptions.to = user.email;
                mailOptions.answerID = req.body.answerID;
                mailOptions.questionID = req.body.questionID;
                mailOptions.appHost = self.config.appHost;
                mailOptions.date = Date();
                var firstName = user.firstName;
                firstName = firstName.substring(0,1).toUpperCase() + firstName.substring(1);
                mailOptions.name = firstName;
                mailOptions.voter = decoded;
                if(decoded.googleId || decoded.facebookId) mailOptions.social = true;
                mailOptions.activity = "Upvote";              
                mailOptions.urlSlug = question.urlSlug;
                var newActivity = LsquareActivities(mailOptions);
                newActivity.save(function(err){
                    if(err) return res.status(500).json(err);
                    var emailTemplate = new EmailTemplate(path.join(templatesDir, 'upvote'));
                    emailTemplate.render(mailOptions, function(err, results){            
                      if(err) return console.error(err)
                      self.transporter.sendMail({
                        from: "help@themediaant.com", // sender address
                        to: mailOptions.to, // list of receivers
                        subject: 'LSquare – Upvote for your Answer',
                        html: results.html
                      }, function(err, responseStatus){
                        if(err) return console.error(err);
                         console.log("mail sent");
                      })
                    });
                  });
              })
            });
          });
        }
    });
  };

  this.show = function(req, res){
    var answerUsersIDs = [];
    Lsquare.findOne({urlSlug: req.params.urlSlug}).lean().exec(function(err, result){
      if(err) return res.status(500).json(err);
      if(!result) return res.status(404).json({error : 'No Such Media Found'});
      User.findOne({_id : result.createdBy}).lean().exec(function(err,userInfo){
        result.createdBy = userInfo;
        LsquareAnswer.find({questionID : result._id.toString()}).lean().exec(function(err, answers){          
         for(i in answers) answerUsersIDs.push(answers[i].answered_by)
         CommonLib.getUserInfo(answerUsersIDs, function(err, userInfo){
          for(i in answers) { answers[i].answered_by = userInfo[answers[i].answered_by];}
          result.answers = answers;
          //to get related question...
          Lsquare.find({tags:{$in:result.tags }}).sort({ views: 1}).lean().limit(5).exec(function(err, Rquestions){
            res.status(200).json({lsquare : result, answersCount : result.answers.length, relatedQuestion : Rquestions});
          })           
         });         
        })        
      });
    });

    var visitor = {
      userAgent: req.headers['user-agent'],
      clientIPAddress: req.headers['x-forwarded-for'] || req.ip,
      urlSlug: req.params.urlSlug,
      type: 'lsquare',
      tool: self.toolName
    };
    CommonLib.uniqueVisits(visitor);
  };

  this.filterSearch = function(req, res){
    var qString = req.query.q;
    console.log(req.query.filter);
    //return res.status(200).json(req.query.filter);
    var qRegExp = new RegExp('\\b'+qString, "i");
    if(req.query.filter == 'tags') {   
      Lsquare.find({tags : { $elemMatch: { $regex: qRegExp } }}, { tags : { $elemMatch: { $regex: qRegExp } } }).lean().exec(function(err, doc){
        if(err) return res.status(500).json(err);
        var topics = [];      
        for(i in doc) {
          topics = topics.concat(doc[i].tags);
        }
        var topics = underscore.uniq(topics);
        return res.send({topics:topics, count:topics.length});
      });
    }
    else if(req.query.filter == 'user'){
      User.find({firstName : { $regex: qRegExp } }).lean().exec(function(err, usersList){
        if(err) return res.status(500).json(err);
        return res.send({users:usersList, count:usersList.length});
      });
    }
  };

  this.search = function(req, res){
    var queryTerms = req.query.q;
    queryTerms = queryTerms.split(' ');
    var query = new RegExp('\\b'+queryTerms.join('|'), 'i');
    for(i in queryTerms) 
    {
      queryTerms[i] = '/' + queryTerms[i] + '/';
    }
    queryTerms = queryTerms.join(' ')
    console.log(query);
    console.log(queryTerms);
    Lsquare.aggregate(
      //{ $match : { question : query } },
      { $match : { $text : { $search : queryTerms } } },
      { $sort: { score :  { $meta: "textScore" } } }, 
      { $project : { urlSlug : 1, question : 1, score : { $meta : "textScore"  } } }, 
      function(err, questions){
        if(err) console.log(err);
        res.status(200).json({questions:questions});
      }
    );
  };

  this.getUser = function(req, res){    
    var qString = req.query.q;
    var qRegExp = new RegExp('\\b'+qString, "i");    
    User.find({firstName : { $regex: qRegExp } }).lean().exec(function(err, usersList){
      if(err) return res.status(500).json(err);
      return res.send({users:usersList, count:usersList.length});
    });
  };

  this.dataImport = function(req, res){ 
  
    //........Insert Questions  
    var path = 'public/bestRate/lsquareQwithTags.json';
    var obj = JSON.parse(fs.readFileSync(path, 'utf8'));

    for(i in obj){
      var data = obj[i];
      data['oldId'] = parseInt(obj[i].id);     
      var newLsquare = Lsquare(data);
      //return res.status(200).json(newLsquare);           
          // save the Media
          newLsquare.save(function(err) {
            if(err) return res.status(500).json(err);  
            return res.status(200).json(newLsquare._id);
          });
    }

    // //........Insert answers  
    // var path = 'public/bestRate/answers_list.json';
    // var obj = JSON.parse(fs.readFileSync(path, 'utf8'));
    // //return res.status(200).json(obj.length);
    // obj = obj.reverse();
    // var iD;

    // for(i in obj){
    //   var ID = obj[i].oldQuestionID
    //   var data = obj[i];      
    //   // Lsquare.findOne({oldId : ID}).lean().exec(function(err, question){        
    //   //   if(question){
    //   //   iD = question._id;}

    //     var newLsquare = LsquareAnswer(obj[i]);
    //     //return res.status(200).json({data : data, obj: obj[i], ID:question});
    //     // save the Media
    //       newLsquare.save(function(err) {
    //         if(err) return res.status(500).json(err);  
    //         return res.status(200).json(newLsquare._id);
    //       });
    //     //return res.status(200).json(data);        
    //   //});

          
    //   // var newLsquare = Lsquare(obj[i]);
    //   // //return res.status(200).json(newLsquare);           
          
    // }
    
    // // console.log(obj.length);
  };
};

module.exports.Lsquare = Lsquare;
