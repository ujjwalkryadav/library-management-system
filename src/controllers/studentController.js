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
    const { phone, address } = req.body;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { phone: phone ? phone.trim() : null }
      }),
      prisma.studentProfile.update({
        where: { id: req.student.id },
        data: { address: address ? address.trim() : null }
      })
    ]);

    setFlash(req, 'success', 'Profile contact details updated successfully.');
    res.redirect('/student/profile');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  renderDashboard,
  renderProfile,
  handleUpdateProfile
};
