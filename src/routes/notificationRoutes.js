const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, notificationController.listNotifications);
router.get('/unread-count', requireAuth, notificationController.getUnreadCount);
router.post('/:id/read', requireAuth, notificationController.markNotificationAsRead);
router.post('/mark-all-read', requireAuth, notificationController.markAllNotificationsAsRead);

module.exports = router;
