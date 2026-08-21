const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const { createSessionConfig } = require('./config/session');
const { attachCurrentUser } = require('./middleware/auth');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Trust reverse proxy (Required for Render, Heroku, Nginx HTTPS cookies)
app.set('trust proxy', 1);

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Bootstrap CDN, Google Fonts, and Chart.js
    crossOriginEmbedderPolicy: false
  })
);

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Session setup
app.use(createSessionConfig());

// Rate Limiter on Authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
});
app.use('/login', authLimiter);
app.use('/register', authLimiter);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// View Engine (.html with EJS dynamic parsing)
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

// Attach user context, flash notifications, settings and template helpers
app.use(attachCurrentUser);

// Master Routes
app.use('/', routes);

// Central Error Handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
