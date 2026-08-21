const { prisma } = require('../config/database');
const { getAdminDashboardStats } = require('../services/reportService');
const { syncOverdueStatuses } = require('../services/issueService');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');

async function renderDashboard(req, res, next) {
  try {
    // Run overdue sync
    await syncOverdueStatuses();
    const stats = await getAdminDashboardStats();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard | Library Management System',
      stats
    });
  } catch (error) {
    next(error);
  }
}

async function listStudents(req, res, next) {
  try {
    const { search, department, status } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 10);

    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { student_id: { contains: q, mode: 'insensitive' } },
        { enrollment_number: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (department && department.trim()) {
      where.department = { contains: department.trim(), mode: 'insensitive' };
    }

    if (status === 'active') {
      where.user = { ...where.user, is_active: true };
    } else if (status === 'inactive') {
      where.user = { ...where.user, is_active: false };
    }

    const [students, total] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        include: {
          user: true,
          _count: {
            select: {
              issues: { where: { status: { in: ['ISSUED', 'OVERDUE'] } } },
              requests: { where: { status: 'PENDING' } },
              fines: { where: { status: 'UNPAID' } }
            }
          }
        },
        orderBy: { joined_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.studentProfile.count({ where })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/students/index', {
      title: 'Student Directory | Admin',
      students,
      pagination,
      search: search || '',
      department: department || '',
      status: status || ''
    });
  } catch (error) {
    next(error);
  }
}

async function viewStudent(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: true,
        issues: {
          include: { book: true, fines: true },
          orderBy: { issue_date: 'desc' }
        },
        requests: {
          include: { book: true },
          orderBy: { request_date: 'desc' }
        },
        fines: {
          include: { issue: { include: { book: true } } },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!student) {
      setFlash(req, 'error', 'Student record not found.');
      return res.redirect('/admin/students');
    }

    res.render('admin/students/show', {
      title: `${student.user.name} - Student Profile | Admin`,
      student
    });
  } catch (error) {
    next(error);
  }
}

async function renderEditStudent(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!student) {
      setFlash(req, 'error', 'Student not found.');
      return res.redirect('/admin/students');
    }

    res.render('admin/students/edit', {
      title: `Edit ${student.user.name} | Admin`,
      student
    });
  } catch (error) {
    next(error);
  }
}

async function handleUpdateStudent(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone, department, course, semester, year, address } = req.body;

    const student = await prisma.studentProfile.findUnique({ where: { id } });
    if (!student) {
      setFlash(req, 'error', 'Student not found.');
      return res.redirect('/admin/students');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.user_id },
        data: {
          name: name ? name.trim() : undefined,
          phone: phone ? phone.trim() : undefined
        }
      }),
      prisma.studentProfile.update({
        where: { id },
        data: {
          department: department ? department.trim() : undefined,
          course: course ? course.trim() : undefined,
          semester: semester ? semester.trim() : undefined,
          year: year ? year.trim() : undefined,
          address: address ? address.trim() : undefined
        }
      })
    ]);

    setFlash(req, 'success', 'Student details successfully updated.');
    res.redirect(`/admin/students/${id}`);
  } catch (error) {
    next(error);
  }
}

async function toggleStudentStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!student) {
      setFlash(req, 'error', 'Student not found.');
      return res.redirect('/admin/students');
    }

    const newStatus = !student.user.is_active;
    await prisma.user.update({
      where: { id: student.user_id },
      data: { is_active: newStatus }
    });

    setFlash(req, 'success', `Student account has been ${newStatus ? 'activated' : 'deactivated'}.`);
    res.redirect(`/admin/students/${id}`);
  } catch (error) {
    next(error);
  }
}

async function listTransactions(req, res, next) {
  try {
    const { search, status, dateFrom, dateTo } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 15);

    const where = {};

    if (status && ['ISSUED', 'RETURNED', 'OVERDUE'].includes(status)) {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { book: { title: { contains: q, mode: 'insensitive' } } },
        { book: { isbn: { contains: q, mode: 'insensitive' } } },
        { student: { student_id: { contains: q, mode: 'insensitive' } } },
        { student: { user: { name: { contains: q, mode: 'insensitive' } } } }
      ];
    }

    if (dateFrom || dateTo) {
      where.issue_date = {};
      if (dateFrom) where.issue_date.gte = new Date(dateFrom);
      if (dateTo) where.issue_date.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const [transactions, total] = await Promise.all([
      prisma.issuedBook.findMany({
        where,
        include: {
          book: true,
          student: { include: { user: true } },
          issuer: true,
          fines: true
        },
        orderBy: { issue_date: 'desc' },
        skip,
        take: limit
      }),
      prisma.issuedBook.count({ where })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/transactions/index', {
      title: 'Audit Transactions Log | Admin',
      transactions,
      pagination,
      search: search || '',
      status: status || '',
      dateFrom: dateFrom || '',
      dateTo: dateTo || ''
    });
  } catch (error) {
    next(error);
  }
}

function renderProfile(req, res) {
  res.render('admin/profile', {
    title: 'Admin Profile | Central Library'
  });
}

async function handleUpdateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name ? name.trim() : undefined,
        phone: phone ? phone.trim() : undefined
      }
    });

    setFlash(req, 'success', 'Profile information updated successfully.');
    res.redirect('/admin/profile');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  renderDashboard,
  listStudents,
  viewStudent,
  renderEditStudent,
  handleUpdateStudent,
  toggleStudentStatus,
  listTransactions,
  renderProfile,
  handleUpdateProfile
};
