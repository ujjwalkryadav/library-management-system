const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const { requirePermission } = require('../middleware/permissionAuth');
const { requireAuth } = require('../middleware/auth');

// Staff & Admin issue management
router.get('/admin', requirePermission('issues.view'), issueController.listAdminIssues);
router.get('/admin/create', requirePermission('issues.create'), issueController.renderDirectIssue);
router.post('/admin/create', requirePermission('issues.create'), issueController.handleDirectIssue);
router.post('/admin/:id/return', requirePermission('issues.return'), issueController.handleProcessReturn);

// Renewal (Student or Staff/Admin)
router.post('/:id/renew', requireAuth, issueController.handleRenewBook);

// Student loans & history
router.get('/student/my-books', requireAuth, issueController.listStudentIssuedBooks);
router.get('/student/history', requireAuth, issueController.listStudentHistory);

module.exports = router;
