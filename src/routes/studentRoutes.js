const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { requireStudent } = require('../middleware/studentAuth');

router.use(requireStudent);

// Dashboard
router.get('/dashboard', studentController.renderDashboard);

// Digital Student ID Card with QR & Barcode
router.get('/id-card', studentController.renderStudentIdCard);

// Student Personal Attendance & Visit History
router.get('/attendance', studentController.renderStudentAttendance);

// Profile
router.get('/profile', studentController.renderProfile);
router.post('/profile', studentController.handleUpdateProfile);

module.exports = router;
