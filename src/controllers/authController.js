const authService = require('../services/authService');
const { setFlash } = require('../middleware/auth');
const { getSystemSettings } = require('../config/settings');

function renderLogin(req, res) {
  if (req.user) {
    if (req.user.role === 'ADMIN') return res.redirect('/admin/dashboard');
    if (req.user.role === 'EMPLOYEE') return res.redirect('/employee/dashboard');
    return res.redirect('/student/dashboard');
  }

  const selectedRole = req.query.role || 'student';

  res.render('auth/login', {
    title: 'Login to Your Account | Library Management System',
    selectedRole,
    email: ''
  });
}

async function handleLogin(req, res) {
  const { email, password, role } = req.body;
  try {
    const user = await authService.verifyLogin(email, password, role);
    req.session.userId = user.id;

    setFlash(req, 'success', `Welcome back, ${user.name}!`);

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    if (returnTo) {
      return res.redirect(returnTo);
    }

    if (user.role === 'ADMIN') {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'EMPLOYEE') {
      return res.redirect('/employee/dashboard');
    } else {
      return res.redirect('/student/dashboard');
    }
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.locals.flash = { error: error.message };
    return res.render('auth/login', {
      title: 'Login to Your Account | Library Management System',
      selectedRole: (role || 'student').toLowerCase(),
      email,
      flash: { error: error.message }
    });
  }
}

async function renderRegister(req, res) {
  if (req.user) {
    if (req.user.role === 'ADMIN') return res.redirect('/admin/dashboard');
    if (req.user.role === 'EMPLOYEE') return res.redirect('/employee/dashboard');
    return res.redirect('/student/dashboard');
  }

  const settings = await getSystemSettings();
  if (!settings.allow_student_registration) {
    setFlash(req, 'warning', 'Public student self-registration is currently closed by the administrator.');
    return res.redirect('/login');
  }

  res.render('auth/register', {
    title: 'Student Registration | Library Management System',
    formData: {}
  });
}

async function handleRegister(req, res) {
  if (req.validationErrors && req.validationErrors.length > 0) {
    setFlash(req, 'error', req.validationErrors.join(' '));
    return res.render('auth/register', {
      title: 'Student Registration | Library Management System',
      formData: req.body
    });
  }

  try {
    const user = await authService.registerStudent(req.body);
    req.session.userId = user.id;
    setFlash(req, 'success', 'Registration successful! Welcome to the Central Library Portal.');
    return res.redirect('/student/dashboard');
  } catch (error) {
    setFlash(req, 'error', error.message);
    return res.render('auth/register', {
      title: 'Student Registration | Library Management System',
      formData: req.body
    });
  }
}

function handleLogout(req, res) {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.clearCookie('lms_sid');
    res.redirect('/login');
  });
}

function renderChangePassword(req, res) {
  res.render('auth/change-password', {
    title: 'Change Password | Library Management System'
  });
}

async function handleChangePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    setFlash(req, 'error', 'New passwords do not match.');
    return res.redirect(req.user.role === 'ADMIN' ? '/admin/profile' : (req.user.role === 'EMPLOYEE' ? '/employee/dashboard' : '/student/profile'));
  }

  try {
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    setFlash(req, 'success', 'Password successfully updated.');
  } catch (error) {
    setFlash(req, 'error', error.message);
  }

  return res.redirect(req.user.role === 'ADMIN' ? '/admin/profile' : (req.user.role === 'EMPLOYEE' ? '/employee/dashboard' : '/student/profile'));
}

module.exports = {
  renderLogin,
  handleLogin,
  renderRegister,
  handleRegister,
  handleLogout,
  renderChangePassword,
  handleChangePassword
};
