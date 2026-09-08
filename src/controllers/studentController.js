const { prisma } = require('../config/database');
const { syncOverdueStatuses } = require('../services/issueService');
const { setFlash } = require('../middleware/auth');

async function renderDashboard(req, res, next) {
  try {
    // Run overdue sync
    await syncOverdueStatuses();

    const studentId = req.student.id;

    const [
      activeIssues,
      pendingRequests,
      recentHistory,
      finesAgg,
      unreadNotifications,
      activeMembership
    ] = await Promise.all([
      prisma.issuedBook.findMany({
        where: {
          student_id: studentId,
          status: { in: ['ISSUED', 'OVERDUE'] }
        },
        include: {
          book: { include: { author: true } },
          fines: true
        },
        orderBy: { due_date: 'asc' }
      }),
      prisma.bookIssueRequest.findMany({
        where: {
          student_id: studentId,
          status: 'PENDING'
        },
        include: {
          book: { include: { author: true } }
        },
        orderBy: { request_date: 'desc' }
      }),
      prisma.issuedBook.findMany({
        where: {
          student_id: studentId,
          status: 'RETURNED'
        },
        include: {
          book: { include: { author: true } }
        },
        orderBy: { returned_date: 'desc' },
        take: 5
      }),
      prisma.fine.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          student_id: studentId,
          status: 'UNPAID'
        }
      }),
      prisma.notification.findMany({
        where: {
          user_id: req.user.id,
          is_read: false
        },
        orderBy: { created_at: 'desc' },
        take: 5
      }),
      prisma.studentMembership.findFirst({
        where: { student_id: studentId },
        orderBy: { valid_until: 'desc' }
      })
    ]);

    const overdueCount = activeIssues.filter(i => i.status === 'OVERDUE').length;

    res.render('student/dashboard', {
      title: 'Student Dashboard | Central Library',
      activeIssues,
      pendingRequests,
      recentHistory,
      overdueCount,
      unpaidFinesTotal: finesAgg._sum.amount ? parseFloat(finesAgg._sum.amount) : 0,
      unpaidFinesCount: finesAgg._count.id || 0,
      unreadNotifications,
      activeMembership
    });
  } catch (error) {
    next(error);
  }
}

async function renderProfile(req, res, next) {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.student.id },
      include: {
        user: true,
        _count: {
          select: {
            issues: true,
            requests: true,
            fines: true
          }
        }
      }
    });

    res.render('student/profile', {
      title: 'My Profile | Central Library',
      student
    });
  } catch (error) {
    next(error);
  }
}

async function handleUpdateProfile(req, res, next) {
  try {
    const { name, phone, address } = req.body;
    if (name || phone !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(phone !== undefined ? { phone: phone.trim() } : {})
        }
      });
    }

    if (address !== undefined) {
      await prisma.studentProfile.update({
        where: { id: req.student.id },
        data: { address: address.trim() }
      });
    }

    setFlash(req, 'success', 'Profile updated successfully.');
    res.redirect('/student/profile');
  } catch (error) {
    next(error);
  }
}

async function renderStudentIdCard(req, res, next) {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.student.id },
      include: {
        user: true,
        memberships: {
          orderBy: { valid_until: 'desc' },
          take: 1
        },
        _count: {
          select: {
            issues: { where: { status: { in: ['ISSUED', 'OVERDUE'] } } },
            attendances: true
          }
        }
      }
    });

    if (!student) {
      setFlash(req, 'error', 'Student profile not found.');
      return res.redirect('/student/dashboard');
    }

    // Ensure qr_code_token exists
    if (!student.qr_code_token) {
      student.qr_code_token = `QR-STU-${student.student_id}`;
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { qr_code_token: student.qr_code_token }
      });
    }

    const activeMembership = student.memberships.length > 0 ? student.memberships[0] : null;

    res.render('student/id-card', {
      title: 'My Digital Library ID Card & QR Code | Central Library',
      student,
      activeMembership
    });
  } catch (error) {
    next(error);
  }
}

async function renderStudentAttendance(req, res, next) {
  try {
    const student = req.student;
    const attendanceService = require('../services/attendanceService');
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
  renderDashboard,
  renderProfile,
  handleUpdateProfile,
  renderStudentIdCard,
  renderStudentAttendance
};

