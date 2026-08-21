const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');

router.get('/login', authController.renderLogin);
router.post('/login', authController.handleLogin);

router.get('/register', authController.renderRegister);
router.post('/register', validateRegister, authController.handleRegister);

router.post('/logout', authController.handleLogout);
router.get('/logout', authController.handleLogout);

router.get('/change-password', requireAuth, authController.renderChangePassword);
router.post('/change-password', requireAuth, authController.handleChangePassword);

module.exports = router;
