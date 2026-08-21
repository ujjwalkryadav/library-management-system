function notFoundHandler(req, res, next) {
  res.status(404).render('errors/404', {
    title: '404 - Page Not Found',
    path: req.originalUrl,
    message: 'The page or resource you requested could not be found.'
  });
}

function globalErrorHandler(err, req, res, next) {
  console.error('Unhandled Application Error:', err);

  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).render('errors/500', {
    title: `${statusCode} - Server Error`,
    message: isProduction ? 'An unexpected internal error occurred. Please contact the library administrator.' : err.message,
    error: isProduction ? {} : err
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
