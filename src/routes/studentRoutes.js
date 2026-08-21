const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { requireStudent } = require('../middleware/studentAuth');

router.use(requireStudent);

// Dashboard
router.get('/dashboard', studentController.renderDashboard);

// Profile
router.get('/profile', studentController.renderProfile);
router.post('/profile', studentController.handleUpdateProfile);

module.exports = router;
