const { prisma } = require('../config/database');

async function createNotification({ userId, title, message, type = 'GENERAL' }) {
  try {
    return await prisma.notification.create({
      data: {
        user_id: parseInt(userId, 10),
        title,
        message,
        type,
        is_read: false
      }
    });
  } catch (err) {
    console.error('Error creating notification:', err.message);
  }
}

async function notifyAdmins({ title, message, type = 'GENERAL' }) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', is_active: true }
    });

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message,
      type,
      is_read: false
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications
      });
    }
  } catch (err) {
    console.error('Error notifying admins:', err.message);
  }
}

async function markAsRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: {
      id: parseInt(notificationId, 10),
      user_id: parseInt(userId, 10)
    },
    data: { is_read: true }
  });
}

async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: {
      user_id: parseInt(userId, 10),
      is_read: false
    },
    data: { is_read: true }
  });
}

async function getUserNotifications(userId, limit = 20) {
  return prisma.notification.findMany({
    where: { user_id: parseInt(userId, 10) },
    orderBy: { created_at: 'desc' },
    take: limit
  });
}

module.exports = {
  createNotification,
  notifyAdmins,
  markAsRead,
  markAllAsRead,
  getUserNotifications
};
