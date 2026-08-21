const { prisma } = require('../config/database');

async function logActivity({ userId, action, entity, entityId = null, details = null, ipAddress = null }) {
  try {
    if (!userId) return;
    await prisma.employeeActivityLog.create({
      data: {
        user_id: parseInt(userId, 10),
        action,
        entity,
        entity_id: entityId ? parseInt(entityId, 10) : null,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ip_address: ipAddress || null
      }
    });
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

module.exports = {
  logActivity
};
