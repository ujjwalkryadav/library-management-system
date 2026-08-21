const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissionAuth');

// Staff dashboard
router.get('/dashboard', requireAuth, employeeController.renderEmployeeDashboard);

module.exports = router;
