const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { requireStudent } = require('../middleware/studentAuth');
const { requirePermission } = require('../middleware/permissionAuth');

// Student requests
router.post('/books/:id/request', requireStudent, requestController.handleStudentRequest);
router.post('/create', requireStudent, requestController.handleStudentRequest);
router.get('/student', requireStudent, requestController.listStudentRequests);

// Staff & Admin request queue
router.get('/admin', requirePermission('requests.view'), requestController.listAdminRequests);
router.post('/admin/:id/approve', requirePermission('requests.approve'), requestController.handleApproveRequest);
router.post('/admin/:id/reject', requirePermission('requests.reject'), requestController.handleRejectRequest);

module.exports = router;
