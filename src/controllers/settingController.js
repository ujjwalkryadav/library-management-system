const { prisma } = require('../config/database');
const { getSystemSettings, updateSystemSetting } = require('../config/settings');
const { setFlash } = require('../middleware/auth');

async function listSettings(req, res, next) {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' }
    });

    res.render('admin/settings/index', {
      title: 'Library System Policies & Settings | Admin',
      settings
    });
  } catch (error) {
    next(error);
  }
}

async function handleUpdateSettings(req, res, next) {
  try {
    const {
      library_name,
      max_books_per_student,
      loan_period_days,
      fine_per_day,
      renewal_limit,
      allow_student_registration
    } = req.body;

    if (library_name) await updateSystemSetting('library_name', library_name.trim());
    if (max_books_per_student) await updateSystemSetting('max_books_per_student', parseInt(max_books_per_student, 10));
    if (loan_period_days) await updateSystemSetting('loan_period_days', parseInt(loan_period_days, 10));
    if (fine_per_day) await updateSystemSetting('fine_per_day', parseFloat(fine_per_day));
    if (renewal_limit) await updateSystemSetting('renewal_limit', parseInt(renewal_limit, 10));
    
    // Checkbox returns 'on' if checked, undefined if not
    const regAllowed = allow_student_registration === 'on' || allow_student_registration === 'true';
    await updateSystemSetting('allow_student_registration', regAllowed ? 'true' : 'false');

    setFlash(req, 'success', 'Library policy settings saved successfully.');
    res.redirect('/admin/settings');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect('/admin/settings');
  }
}

module.exports = {
  listSettings,
  handleUpdateSettings
};
