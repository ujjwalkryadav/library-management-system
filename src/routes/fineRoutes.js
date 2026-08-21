const express = require('express');
const router = express.Router();
const fineController = require('../controllers/fineController');
const { requirePermission } = require('../middleware/permissionAuth');
const { requireStudent } = require('../middleware/studentAuth');
const { uploadPaymentProof } = require('../middleware/upload');

// Staff & Admin fines
router.get('/admin', requirePermission('fines.view'), fineController.listAdminFines);
router.post('/admin/:id/pay', requirePermission('fines.mark_paid'), fineController.handlePayFine);
router.post('/admin/:id/approve-upi', requirePermission('fines.mark_paid'), fineController.handleApproveUpiFine);
router.post('/admin/:id/reject-upi', requirePermission('fines.mark_paid'), fineController.handleRejectUpiFine);
router.post('/admin/:id/waive', requirePermission('fines.waive'), fineController.handleWaiveFine);

// Student fines
router.get('/student', requireStudent, fineController.listStudentFines);
router.post('/student/:id/pay-upi', requireStudent, uploadPaymentProof.single('screenshot'), fineController.submitStudentUpiFinePayment);

module.exports = router;
