const { setFlash } = require('./auth');

function requireStudent(req, res, next) {
  if (!req.user) {
    setFlash(req, 'error', 'Student login required.');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  if (req.user.role !== 'STUDENT') {
    return res.status(403).render('errors/403', {
      title: '403 Forbidden',
      message: 'Access Denied: This area is reserved for registered students.'
    });
  }

  if (!req.user.is_active) {
    req.session.destroy();
    return res.status(403).render('errors/403', {
      title: 'Account Inactive',
      message: 'Your student account is currently deactivated. Please contact the library administrator.'
    });
  }

  if (!req.student) {
    return res.status(403).render('errors/403', {
      title: 'Profile Incomplete',
      message: 'No student profile record found. Please contact the administrator.'
    });
  }

  next();
}

module.exports = {
  requireStudent
};
