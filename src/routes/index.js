const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const employeeRoutes = require('./employeeRoutes');
const studentRoutes = require('./studentRoutes');
const bookRoutes = require('./bookRoutes');
const requestRoutes = require('./requestRoutes');
const issueRoutes = require('./issueRoutes');
const fineRoutes = require('./fineRoutes');
const membershipRoutes = require('./membershipRoutes');
const notificationRoutes = require('./notificationRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const homeController = require('../controllers/homeController');

// Homepage
router.get('/', homeController.renderHomepage);

// Auth & Module Routers
router.use('/', authRoutes);
router.use('/books', bookRoutes);
router.use('/requests', requestRoutes);
router.use('/issues', issueRoutes);
router.use('/fines', fineRoutes);
router.use('/memberships', membershipRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/employee', employeeRoutes);
router.use('/student', studentRoutes);

module.exports = router;
