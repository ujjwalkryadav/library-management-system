const notificationService = require('../services/notificationService');
const { prisma } = require('../config/database');
const { setFlash } = require('../middleware/auth');

async function listNotifications(req, res, next) {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.id, 50);

    const viewPath = req.user.role === 'ADMIN' ? 'admin/notifications' : 'student/notifications';

    res.render(viewPath, {
      title: 'Notifications | Central Library',
      notifications
    });
  } catch (error) {
    next(error);
  }
}

async function markNotificationAsRead(req, res, next) {
  const id = parseInt(req.params.id, 10);
  try {
    await notificationService.markAsRead(id, req.user.id);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({ success: true });
    }
    setFlash(req, 'success', 'Notification marked as read.');
    res.redirect(req.headers.referer || '/notifications');
  } catch (error) {
    next(error);
  }
}

async function markAllNotificationsAsRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.id);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({ success: true });
    }
    setFlash(req, 'success', 'All notifications marked as read.');
    res.redirect(req.headers.referer || '/notifications');
  } catch (error) {
    next(error);
  }
}

async function getUnreadCount(req, res) {
  try {
    if (!req.user) return res.json({ count: 0 });
    const count = await prisma.notification.count({
      where: { user_id: req.user.id, is_read: false }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
};
