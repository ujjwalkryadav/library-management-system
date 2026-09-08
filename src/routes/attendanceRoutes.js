const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissionAuth');

// All attendance staff routes require authentication
router.use(requireAuth);

// Live Camera QR / Barcode Scanner
router.get('/scanner', requirePermission('attendance.scan'), attendanceController.renderScannerPage);
router.get('/admin/scanner', requirePermission('attendance.scan'), attendanceController.renderScannerPage);
router.post('/api/scan', requirePermission('attendance.scan'), attendanceController.handleScanApi);

// Attendance Ledger & Analytics
router.get('/admin', requirePermission('attendance.view'), attendanceController.listAttendance);
router.get('/ledger', requirePermission('attendance.view'), attendanceController.listAttendance);
router.get('/', requirePermission('attendance.view'), attendanceController.listAttendance);

// Manual Management by Teachers / Staff
router.post('/manual', requirePermission('attendance.manage'), attendanceController.handleManualAttendance);
router.post('/:id/update', requirePermission('attendance.manage'), attendanceController.handleUpdateAttendance);
router.post('/:id/delete', requirePermission('attendance.manage'), attendanceController.handleDeleteAttendance);

module.exports = router;
