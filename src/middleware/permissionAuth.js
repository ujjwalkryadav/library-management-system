const { setFlash } = require('./auth');

function hasPermission(user, permissionKey) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'EMPLOYEE') return false;

  if (!user.is_active || !user.employee_profile || user.employee_profile.status !== 'ACTIVE') {
    return false;
  }

  const userPerms = user.employee_profile.permissions?.map(p => p.permission) || [];
  return userPerms.includes(permissionKey);
}

function requirePermission(permissionKey) {
  return function (req, res, next) {
    if (!req.user) {
      setFlash(req, 'error', 'Authentication required to access this resource.');
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }

    // Admin has full override access
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Students are blocked
    if (req.user.role !== 'EMPLOYEE') {
      return res.status(403).render('errors/403', {
        title: '403 Forbidden',
        message: 'Access Denied: This operational module is restricted to library staff and administrators.'
      });
    }

    // Check active status
    if (!req.user.is_active || !req.employee || req.employee.status !== 'ACTIVE') {
      req.session.destroy();
      return res.status(403).render('errors/403', {
        title: '403 Forbidden',
        message: 'Your employee staff account has been deactivated. Please contact the administrator.'
      });
    }

    // Check specific permission
    const granted = hasPermission(req.user, permissionKey);
    if (!granted) {
      return res.status(403).render('errors/403', {
        title: '403 Forbidden',
        message: `Access Denied: Your staff role lacks the required permission: "${permissionKey}". Please contact the chief librarian.`
      });
    }

    next();
  };
}

module.exports = {
  hasPermission,
  requirePermission
};
