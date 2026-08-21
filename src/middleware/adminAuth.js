const { requireAuth, setFlash } = require('./auth');

function requireAdmin(req, res, next) {
  if (!req.user) {
    setFlash(req, 'error', 'Administrator login required.');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).render('errors/403', {
      title: '403 Forbidden',
      message: 'Access Denied: You do not have administrator permissions to access this page.'
    });
  }

  next();
}

module.exports = {
  requireAdmin
};
