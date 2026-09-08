const { prisma } = require('../config/database');
const { createNotification } = require('./notificationService');
const { logActivity } = require('./activityLogger');

/**
 * Find student by QR Token, Student ID, or ID
 */
async function findStudentByIdentifier(identifier) {
  if (!identifier) return null;
  const cleanId = String(identifier).trim();

  return await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { qr_code_token: cleanId },
        { student_id: { equals: cleanId, mode: 'insensitive' } },
        { enrollment_number: { equals: cleanId, mode: 'insensitive' } },
        ...(!isNaN(parseInt(cleanId, 10)) ? [{ id: parseInt(cleanId, 10) }] : [])
      ]
    },
    include: {
      user: true,
      issues: {
        where: { status: { in: ['ISSUED', 'OVERDUE'] } },
        include: { book: true },
        orderBy: { due_date: 'asc' }
      },
      fines: {
        where: { status: 'UNPAID' },
        include: { issue: { include: { book: true } } }
      },
      memberships: {
        orderBy: { valid_until: 'desc' },
        take: 1
      },
      _count: {
        select: {
          attendances: true
        }
      }
    }
  });
}

/**
 * Record attendance scan (Check-in or Check-out)
 */
async function recordScanAttendance({ studentIdentifier, staffId, scanMode = 'QR_SCAN', notes = null }) {
  const student = await findStudentByIdentifier(studentIdentifier);

  if (!student) {
    throw new Error(`Student not found with identifier: "${studentIdentifier}". Please verify the QR code or Student ID.`);
  }

  if (!student.user.is_active) {
    throw new Error(`Student account for ${student.user.name} (${student.student_id}) is deactivated.`);
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Check today's existing attendance
  const existingToday = await prisma.studentAttendance.findFirst({
    where: {
      student_id: student.id,
      date: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    orderBy: { created_at: 'desc' }
  });

  let attendanceRecord;
  let actionType = 'CHECK_IN';
  let message = '';

  if (!existingToday) {
    // 1. Initial Check-In for Today
    attendanceRecord = await prisma.studentAttendance.create({
      data: {
        student_id: student.id,
        date: now,
        check_in: now,
        status: 'PRESENT',
        scanned_by: staffId ? parseInt(staffId, 10) : null,
        scan_mode: scanMode,
        notes: notes || 'Scanned via Library QR Attendance Scanner'
      },
      include: {
        student: { include: { user: true } },
        scanner: true
      }
    });

    actionType = 'CHECK_IN';
    message = `Check-in recorded for ${student.user.name} (${student.student_id}) at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`;

    if (staffId) {
      await logActivity({
        userId: staffId,
        action: 'ATTENDANCE_CHECK_IN',
        entity: 'StudentAttendance',
        entityId: attendanceRecord.id,
        details: `Recorded QR check-in for student ${student.user.name} (${student.student_id})`
      });
    }

    // In-app notification for student
    await createNotification({
      userId: student.user_id,
      title: 'Library Check-In Confirmed',
      message: `Your attendance check-in was recorded at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Have a productive study session!`,
      type: 'ATTENDANCE'
    });
  } else if (!existingToday.check_out) {
    // 2. Check-Out on 2nd Scan
    attendanceRecord = await prisma.studentAttendance.update({
      where: { id: existingToday.id },
      data: {
        check_out: now,
        notes: notes ? `${existingToday.notes || ''} | ${notes}` : existingToday.notes
      },
      include: {
        student: { include: { user: true } },
        scanner: true
      }
    });

    actionType = 'CHECK_OUT';
    message = `Check-out recorded for ${student.user.name} (${student.student_id}) at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`;

    if (staffId) {
      await logActivity({
        userId: staffId,
        action: 'ATTENDANCE_CHECK_OUT',
        entity: 'StudentAttendance',
        entityId: attendanceRecord.id,
        details: `Recorded QR check-out for student ${student.user.name} (${student.student_id})`
      });
    }

    await createNotification({
      userId: student.user_id,
      title: 'Library Check-Out Recorded',
      message: `Your check-out was recorded at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Thank you for visiting!`,
      type: 'ATTENDANCE'
    });
  } else {
    // 3. Already Completed Check-in & Check-out today
    attendanceRecord = existingToday;
    actionType = 'ALREADY_COMPLETED';
    message = `${student.user.name} has already completed attendance today (In: ${new Date(existingToday.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}, Out: ${new Date(existingToday.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}).`;
  }

  // Calculate unpaid fines total
  const totalUnpaidFines = student.fines.reduce((sum, f) => sum + parseFloat(f.amount), 0);
  const activeMembership = student.memberships.length > 0 ? student.memberships[0] : null;

  return {
    action: actionType,
    message,
    attendance: attendanceRecord,
    student: {
      id: student.id,
      name: student.user.name,
      email: student.user.email,
      phone: student.user.phone || 'N/A',
      student_id: student.student_id,
      enrollment_number: student.enrollment_number || 'N/A',
      department: student.department,
      course: student.course,
      semester: student.semester || 'N/A',
      qr_code_token: student.qr_code_token || student.student_id,
      active_issues_count: student.issues.length,
      active_issues: student.issues.map(i => ({
        id: i.id,
        book_title: i.book.title,
        due_date: i.due_date,
        is_overdue: i.status === 'OVERDUE' || new Date(i.due_date) < new Date()
      })),
      unpaid_fines_count: student.fines.length,
      unpaid_fines_total: totalUnpaidFines,
      membership_pass: activeMembership ? {
        plan_name: activeMembership.plan_name,
        fee_status: activeMembership.fee_status,
        valid_until: activeMembership.valid_until,
        is_active: activeMembership.fee_status === 'PAID' && new Date(activeMembership.valid_until) >= new Date()
      } : null
    }
  };
}

/**
 * Get Attendance Ledger & Analytics
 */
async function getAttendanceLogs({ date, search, department, status, skip = 0, limit = 20 }) {
  const where = {};

  const now = new Date();
  let startOfDay;
  let endOfDay;
  let selectedDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (date !== 'all') {
    let y = now.getFullYear();
    let m = now.getMonth();
    let d = now.getDate();

    if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      const parts = date.trim().split('-').map(Number);
      y = parts[0];
      m = parts[1] - 1;
      d = parts[2];
      selectedDateStr = date.trim();
    } else if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        y = parsed.getFullYear();
        m = parsed.getMonth();
        d = parsed.getDate();
        selectedDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    startOfDay = new Date(y, m, d, 0, 0, 0, 0);
    endOfDay = new Date(y, m, d, 23, 59, 59, 999);

    where.date = {
      gte: startOfDay,
      lte: endOfDay
    };
  } else {
    // For 'all', calculate stats based on today
    startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  if (status && ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  if (department && department.trim()) {
    where.student = {
      ...where.student,
      department: { contains: department.trim(), mode: 'insensitive' }
    };
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.student = {
      ...where.student,
      OR: [
        { student_id: { contains: q, mode: 'insensitive' } },
        { enrollment_number: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } }
      ]
    };
  }

  const statsStart = startOfDay || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const statsEnd = endOfDay || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [attendances, total, totalStudents, todayPresentCount, todayCheckedOutCount, todayLateCount] = await Promise.all([
    prisma.studentAttendance.findMany({
      where,
      include: {
        student: {
          include: { user: true }
        },
        scanner: true
      },
      orderBy: { check_in: 'desc' },
      skip,
      take: limit
    }),
    prisma.studentAttendance.count({ where }),
    prisma.studentProfile.count(),
    prisma.studentAttendance.count({
      where: {
        date: { gte: statsStart, lte: statsEnd },
        status: { in: ['PRESENT', 'LATE'] }
      }
    }),
    prisma.studentAttendance.count({
      where: {
        date: { gte: statsStart, lte: statsEnd },
        check_out: { not: null }
      }
    }),
    prisma.studentAttendance.count({
      where: {
        date: { gte: statsStart, lte: statsEnd },
        status: 'LATE'
      }
    })
  ]);

  const attendanceRate = totalStudents > 0 ? Math.round((todayPresentCount / totalStudents) * 100) : 0;

  return {
    attendances,
    total,
    selectedDateStr,
    stats: {
      totalStudents,
      todayPresentCount,
      todayCheckedOutCount,
      todayLateCount,
      attendanceRate
    }
  };
}

/**
 * Manually mark student attendance
 */
async function markManualAttendance({ studentId, date, checkInTime, checkOutTime, status = 'PRESENT', staffId, notes }) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: parseInt(studentId, 10) },
    include: { user: true }
  });

  if (!student) {
    throw new Error('Student profile not found.');
  }

  const attendanceDate = date ? new Date(date) : new Date();
  let checkIn = new Date(attendanceDate);
  if (checkInTime) {
    const [h, m] = checkInTime.split(':');
    checkIn.setHours(parseInt(h, 10) || 9, parseInt(m, 10) || 0, 0, 0);
  }

  let checkOut = null;
  if (checkOutTime) {
    checkOut = new Date(attendanceDate);
    const [h, m] = checkOutTime.split(':');
    checkOut.setHours(parseInt(h, 10) || 17, parseInt(m, 10) || 0, 0, 0);
  }

  const attendance = await prisma.studentAttendance.create({
    data: {
      student_id: student.id,
      date: attendanceDate,
      check_in: checkIn,
      check_out: checkOut,
      status: ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].includes(status) ? status : 'PRESENT',
      scanned_by: staffId ? parseInt(staffId, 10) : null,
      scan_mode: 'MANUAL',
      notes: notes || 'Manual entry by staff'
    },
    include: {
      student: { include: { user: true } }
    }
  });

  if (staffId) {
    await logActivity({
      userId: staffId,
      action: 'MANUAL_ATTENDANCE_CREATED',
      entity: 'StudentAttendance',
      entityId: attendance.id,
      details: `Manually marked attendance (${status}) for ${student.user.name} on ${attendanceDate.toLocaleDateString('en-IN')}`
    });
  }

  return attendance;
}

/**
 * Update existing attendance record
 */
async function updateAttendance(id, { checkIn, checkOut, status, notes, staffId }) {
  const existing = await prisma.studentAttendance.findUnique({
    where: { id: parseInt(id, 10) },
    include: { student: { include: { user: true } } }
  });

  if (!existing) {
    throw new Error('Attendance record not found.');
  }

  const updateData = {};
  if (status && ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'].includes(status)) {
    updateData.status = status;
  }
  if (notes !== undefined) {
    updateData.notes = notes;
  }
  if (checkIn) {
    updateData.check_in = new Date(checkIn);
  }
  if (checkOut) {
    updateData.check_out = new Date(checkOut);
  }

  const updated = await prisma.studentAttendance.update({
    where: { id: parseInt(id, 10) },
    data: updateData,
    include: {
      student: { include: { user: true } }
    }
  });

  if (staffId) {
    await logActivity({
      userId: staffId,
      action: 'ATTENDANCE_UPDATED',
      entity: 'StudentAttendance',
      entityId: updated.id,
      details: `Updated attendance record #${id} for ${existing.student.user.name}`
    });
  }

  return updated;
}

/**
 * Delete attendance record
 */
async function deleteAttendance(id, staffId) {
  const existing = await prisma.studentAttendance.findUnique({
    where: { id: parseInt(id, 10) },
    include: { student: { include: { user: true } } }
  });

  if (!existing) {
    throw new Error('Attendance record not found.');
  }

  await prisma.studentAttendance.delete({
    where: { id: parseInt(id, 10) }
  });

  if (staffId) {
    await logActivity({
      userId: staffId,
      action: 'ATTENDANCE_DELETED',
      entity: 'StudentAttendance',
      entityId: parseInt(id, 10),
      details: `Deleted attendance record for ${existing.student.user.name}`
    });
  }

  return existing;
}

/**
 * Get student's personal attendance report
 */
async function getStudentAttendanceSummary(studentProfileId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [attendances, totalMonthCount, totalPresentCount, totalLateCount] = await Promise.all([
    prisma.studentAttendance.findMany({
      where: { student_id: parseInt(studentProfileId, 10) },
      orderBy: { date: 'desc' },
      take: 30
    }),
    prisma.studentAttendance.count({
      where: {
        student_id: parseInt(studentProfileId, 10),
        date: { gte: startOfMonth }
      }
    }),
    prisma.studentAttendance.count({
      where: {
        student_id: parseInt(studentProfileId, 10),
        status: 'PRESENT'
      }
    }),
    prisma.studentAttendance.count({
      where: {
        student_id: parseInt(studentProfileId, 10),
        status: 'LATE'
      }
    })
  ]);

  return {
    attendances,
    monthName: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    totalMonthCount,
    totalPresentCount,
    totalLateCount
  };
}

module.exports = {
  findStudentByIdentifier,
  recordScanAttendance,
  getAttendanceLogs,
  markManualAttendance,
  updateAttendance,
  deleteAttendance,
  getStudentAttendanceSummary
};
