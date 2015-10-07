//config file. Ignore by GIT.
var config = {
  //SMTP Configs
  smtpService : 'smtp.mandrillapp.com',
  smtpHost : 'smtp.mandrillapp.com',
  smtpAuth : {
    user: 'manjunath@themediaant.com',
    pass: 'pWCZVZ17BC26LNamo3GNoA'
  },
  smtpPort:587,

  //Database Configs for server
  mongoUrl : "mongodb://root:goosebumps@139.162.29.37/media_ant?authSource=admin",

  //Database Configs for local
  //mongoUrl : "mongodb://localhost/media_ant_two",

  //Domain Name Configs
  appHost : 'beta.themediaant.com',

  //EmailID Configs
  noreply : 'The Media Ant <noreply@themediaant.com>',
  help : 'The Media Ant <help@themediaant.com>',

  //Miscellaneous Configs
  secret : "iamyoursecret"
};

module.exports = config;