const attendanceService = require('../services/attendanceService');
const { prisma } = require('../config/database');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');

/**
 * Render Camera QR Scanner page (Admin & Staff)
 */
async function renderScannerPage(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { stats } = await attendanceService.getAttendanceLogs({ date: today });

    // Recent 5 scans today
    const recentScans = await prisma.studentAttendance.findMany({
      where: {
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      },
      include: {
        student: { include: { user: true } },
        scanner: true
      },
      orderBy: { created_at: 'desc' },
      take: 6
    });

    res.render('admin/attendance/scanner', {
      title: 'Real-Time Student QR Code & Barcode Attendance Scanner | Library Central',
      stats,
      recentScans
    });
  } catch (error) {
    next(error);
  }
}

/**
 * AJAX API for camera QR / barcode scanning
 */
async function handleScanApi(req, res) {
  try {
    const { identifier, scanMode, notes } = req.body;

    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Student QR code or Student ID is required.'
      });
    }

    const result = await attendanceService.recordScanAttendance({
      studentIdentifier: identifier.trim(),
      staffId: req.user ? req.user.id : null,
      scanMode: scanMode || 'QR_SCAN',
      notes: notes || null
    });

    return res.json({
      success: true,
      action: result.action,
      message: result.message,
      attendance: result.attendance,
      student: result.student
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to process QR attendance scan.'
    });
  }
}

/**
 * Attendance ledger list view (Admin & Staff)
 */
async function listAttendance(req, res, next) {
  try {
    const { date, search, department, status } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 15);

    const { attendances, total, stats, selectedDateStr } = await attendanceService.getAttendanceLogs({
      date: date || undefined,
      search,
      department,
      status,
      skip,
      limit
    });

    // All active students for manual entry modal dropdown
    const allStudents = await prisma.studentProfile.findMany({
      where: { user: { is_active: true } },
      include: { user: true },
      orderBy: { student_id: 'asc' }
    });

    // Unique departments for filter
    const departments = await prisma.studentProfile.findMany({
      select: { department: true },
      distinct: ['department']
    });

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/attendance/index', {
      title: 'Daily Student Attendance Ledger & Analytics | Library Central',
      attendances,
      stats,
      pagination,
      allStudents,
      departments: departments.map(d => d.department),
      selectedDate: date || selectedDateStr,
      search: search || '',
      selectedDepartment: department || '',
      selectedStatus: status || ''
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle manual attendance creation
 */
async function handleManualAttendance(req, res, next) {
  try {
    const { studentId, date, checkInTime, checkOutTime, status, notes } = req.body;

    if (!studentId) {
      setFlash(req, 'error', 'Please select a student.');
      return res.redirect(req.headers.referer || '/attendance/admin');
    }

    await attendanceService.markManualAttendance({
      studentId,
      date,
      checkInTime,
      checkOutTime,
      status: status || 'PRESENT',
      staffId: req.user.id,
      notes: notes ? notes.trim() : 'Manual entry by staff'
    });

    setFlash(req, 'success', 'Attendance record added successfully.');
    res.redirect(req.headers.referer || '/attendance/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/attendance/admin');
  }
}

/**
 * Handle updating attendance record
 */
async function handleUpdateAttendance(req, res, next) {
  const id = parseInt(req.params.id, 10);
  try {
    const { checkIn, checkOut, status, notes } = req.body;

    await attendanceService.updateAttendance(id, {
      checkIn,
      checkOut: checkOut || null,
      status,
      notes,
      staffId: req.user.id
    });

    setFlash(req, 'success', 'Attendance record updated successfully.');
    res.redirect(req.headers.referer || '/attendance/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/attendance/admin');
  }
}

/**
 * Handle deleting attendance record
 */
async function handleDeleteAttendance(req, res, next) {
  const id = parseInt(req.params.id, 10);
  try {
    await attendanceService.deleteAttendance(id, req.user.id);
    setFlash(req, 'success', 'Attendance record removed.');
    res.redirect(req.headers.referer || '/attendance/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/attendance/admin');
  }
}

/**
 * Student's personal attendance view
 */
async function renderStudentAttendance(req, res, next) {
  try {
    const student = req.student;
    if (!student) {
      return res.redirect('/login');
    }

    const data = await attendanceService.getStudentAttendanceSummary(student.id);

    res.render('student/attendance', {
      title: 'My Library Attendance & Visit History | Central Library',
      ...data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  renderScannerPage,
  handleScanApi,
  listAttendance,
  handleManualAttendance,
  handleUpdateAttendance,
  handleDeleteAttendance,
  renderStudentAttendance
};
