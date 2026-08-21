const { prisma } = require('../config/database');
const { getSystemSettings } = require('../config/settings');
const helpers = require('../utils/helpers');

async function attachCurrentUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentStudent = null;
  res.locals.currentEmployee = null;
  res.locals.unreadNotificationCount = 0;
  res.locals.helpers = helpers;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;

  // Flash messages support using session
  res.locals.flash = {
    success: req.session.flashSuccess || null,
    error: req.session.flashError || null,
    info: req.session.flashInfo || null,
    warning: req.session.flashWarning || null
  };
  delete req.session.flashSuccess;
  delete req.session.flashError;
  delete req.session.flashInfo;
  delete req.session.flashWarning;

  try {
    const settings = await getSystemSettings();
    res.locals.systemSettings = settings;

    if (req.session && req.session.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        include: {
          student_profile: true,
          employee_profile: {
            include: { permissions: true }
          }
        }
      });

      if (user && user.is_active) {
        req.user = user;
        res.locals.currentUser = user;

        if (user.student_profile) {
          req.student = user.student_profile;
          res.locals.currentStudent = user.student_profile;
        }

        if (user.employee_profile) {
          req.employee = user.employee_profile;
          res.locals.currentEmployee = user.employee_profile;
        }

        // Count unread notifications and fetch recent 5 for popup
        const [unreadCount, recentNotifications] = await Promise.all([
          prisma.notification.count({
            where: { user_id: user.id, is_read: false }
          }),
          prisma.notification.findMany({
            where: { user_id: user.id },
            orderBy: { created_at: 'desc' },
            take: 5
          })
        ]);
        res.locals.unreadNotificationCount = unreadCount;
        res.locals.recentNotifications = recentNotifications;
      } else {
        // Inactive or deleted user
        req.session.destroy();
      }
    }
  } catch (error) {
    console.error('Error attaching current user:', error.message);
  }

  // Expose hasPermission helper to templates
  res.locals.hasPermission = function (permKey) {
    const user = res.locals.currentUser;
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role !== 'EMPLOYEE') return false;
    if (!user.is_active || !user.employee_profile || user.employee_profile.status !== 'ACTIVE') return false;
    const perms = user.employee_profile.permissions?.map(p => p.permission) || [];
    return perms.includes(permKey);
  };

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    setFlash(req, 'error', 'Please sign in to access this page.');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function setFlash(req, type, message) {
  if (type === 'success') req.session.flashSuccess = message;
  if (type === 'error') req.session.flashError = message;
  if (type === 'info') req.session.flashInfo = message;
  if (type === 'warning') req.session.flashWarning = message;
}

module.exports = {
  attachCurrentUser,
  requireAuth,
  setFlash
};
