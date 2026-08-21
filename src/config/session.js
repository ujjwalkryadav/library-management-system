const session = require('express-session');

function createSessionConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return session({
    name: 'lms_sid',
    secret: process.env.SESSION_SECRET || 'lms-development-secret-key-change-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  });
}

module.exports = {
  createSessionConfig
};
