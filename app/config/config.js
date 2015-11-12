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

  //Domain Name Configs
  appHost : 'www.themediaant.com',

  //EmailID Configs
  noreply : 'The Media Ant <noreply@themediaant.com>',
  help : 'The Media Ant <help@themediaant.com>',
  m20Help : 'M20 <help@m20.in>',

  //Miscellaneous Configs
  secret : "iamyoursecret",

  //SEO content
  twitter: {
    "card": "website",
    "site": "@themediaant" 
  },
  facebook: {
   "type": "article",
   "siteName": "TheMediaAnt",
   "admins": "" 
  }     
};

module.exports = config;