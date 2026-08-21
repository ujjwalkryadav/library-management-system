const session = require('express-session');

function createSessionConfig() {
  return session({
    name: 'lms_sid',
    secret: process.env.SESSION_SECRET || 'lms-development-secret-key-change-in-prod',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Trust proxy for HTTPS cookie delivery
    cookie: {
      httpOnly: true,
      secure: 'auto', // Automatically adapts to HTTPS behind Render proxy
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  });
}

module.exports = {
  createSessionConfig
};
