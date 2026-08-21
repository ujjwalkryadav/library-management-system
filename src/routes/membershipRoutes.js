const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { requireAuth } = require('../middleware/auth');
const { requireStudent } = require('../middleware/studentAuth');
const { requirePermission } = require('../middleware/permissionAuth');
const { uploadPaymentProof } = require('../middleware/upload');

// Student routes
router.get('/student', requireAuth, requireStudent, membershipController.renderStudentMembership);
router.post('/student/:id/pay-upi', requireAuth, requireStudent, uploadPaymentProof.single('screenshot'), membershipController.submitStudentUpiPayment);

// Admin & Staff routes (requires authentication & permission)
router.get('/admin', requireAuth, requirePermission('fines.view'), membershipController.listMemberships);
router.post('/admin/:id/approve-upi', requireAuth, requirePermission('fines.mark_paid'), membershipController.approveUpiPayment);
router.post('/admin/:id/reject-upi', requireAuth, requirePermission('fines.mark_paid'), membershipController.rejectUpiPayment);
router.post('/admin/:id/pay', requireAuth, requirePermission('fines.mark_paid'), membershipController.markFeePaid);
router.post('/admin/:id/renew', requireAuth, requirePermission('fines.mark_paid'), membershipController.renewMembership);

module.exports = router;
