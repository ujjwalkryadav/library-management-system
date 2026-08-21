const { prisma } = require('./database');

const DEFAULT_SETTINGS = {
  library_name: 'Apex University Central Library',
  max_books_per_student: 3,
  loan_period_days: 14,
  fine_per_day: 5.00,
  renewal_limit: 2,
  allow_student_registration: true
};

let cachedSettings = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

async function getSystemSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedSettings;
  }

  try {
    const dbSettings = await prisma.systemSetting.findMany();
    const settingsMap = { ...DEFAULT_SETTINGS };

    for (const item of dbSettings) {
      if (item.key === 'max_books_per_student' || item.key === 'loan_period_days' || item.key === 'renewal_limit') {
        settingsMap[item.key] = parseInt(item.value, 10) || DEFAULT_SETTINGS[item.key];
      } else if (item.key === 'fine_per_day') {
        settingsMap[item.key] = parseFloat(item.value) || DEFAULT_SETTINGS[item.key];
      } else if (item.key === 'allow_student_registration') {
        settingsMap[item.key] = item.value.toLowerCase() === 'true';
      } else {
        settingsMap[item.key] = item.value;
      }
    }

    cachedSettings = settingsMap;
    lastFetchTime = now;
    return cachedSettings;
  } catch (error) {
    console.error('Error fetching system settings from DB, using defaults:', error.message);
    return DEFAULT_SETTINGS;
  }
}

async function updateSystemSetting(key, value) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) }
  });
  cachedSettings = null; // Invalidate cache
}

module.exports = {
  getSystemSettings,
  updateSystemSetting,
  DEFAULT_SETTINGS
};
