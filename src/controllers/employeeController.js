const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { getGroupedPermissions, PERMISSIONS } = require('../config/permissions');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');
const { getAdminDashboardStats } = require('../services/reportService');
const { syncOverdueStatuses } = require('../services/issueService');

// ==========================================
// EMPLOYEE PORTAL (For Logged-in Staff)
// ==========================================

async function renderEmployeeDashboard(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'EMPLOYEE') {
      return res.status(403).render('errors/403', {
        title: '403 Forbidden',
        message: 'Access Denied: This operations console is restricted to library employee staff members.'
      });
    }
    await syncOverdueStatuses();
    const employee = req.employee;
    if (!employee || employee.status !== 'ACTIVE') {
      return res.status(403).render('errors/403', {
        title: '403 Forbidden',
        message: 'Your staff account is currently deactivated.'
      });
    }
    const permissions = employee.permissions.map(p => p.permission);

    // Compute tailored stats based on granted permissions
    const stats = {};

    if (permissions.includes('books.view')) {
      const [totalBooks, availableCopies] = await Promise.all([
        prisma.book.count({ where: { is_archived: false } }),
        prisma.book.aggregate({
          _sum: { available_copies: true },
          where: { is_archived: false }
        })
      ]);
      stats.totalBooks = totalBooks;
      stats.availableCopies = availableCopies._sum.available_copies || 0;
    }

    if (permissions.includes('issues.view')) {
      const [activeIssues, overdueIssues] = await Promise.all([
        prisma.issuedBook.count({ where: { status: 'ISSUED' } }),
        prisma.issuedBook.count({ where: { status: 'OVERDUE' } })
      ]);
      stats.activeIssues = activeIssues;
      stats.overdueIssues = overdueIssues;
    }

    if (permissions.includes('requests.view')) {
      stats.pendingRequests = await prisma.bookIssueRequest.count({ where: { status: 'PENDING' } });
    }

    if (permissions.includes('fines.view')) {
      const finesAgg = await prisma.fine.aggregate({
        _sum: { amount: true },
        where: { status: 'UNPAID' }
      });
      stats.unpaidFines = finesAgg._sum.amount ? parseFloat(finesAgg._sum.amount) : 0;
    }

    if (permissions.includes('students.view')) {
      stats.totalStudents = await prisma.studentProfile.count();
    }

    // Recent activities performed by THIS employee
    const myRecentActivities = await prisma.employeeActivityLog.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 8
    });

    // Pending requests if authorized
    let pendingRequestsList = [];
    if (permissions.includes('requests.view')) {
      pendingRequestsList = await prisma.bookIssueRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          book: true,
          student: { include: { user: true } }
        },
        orderBy: { request_date: 'desc' },
        take: 5
      });
    }

    res.render('employee/dashboard', {
      title: 'Staff Operations Dashboard | Library Central',
      employee,
      permissions,
      stats,
      myRecentActivities,
      pendingRequestsList
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// ADMIN EMPLOYEE MANAGEMENT CONTROLLERS
// ==========================================

async function listEmployees(req, res, next) {
  try {
    const { search, department, status } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 10);

    const where = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { employee_id: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { designation: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (department && department.trim()) {
      where.department = { contains: department.trim(), mode: 'insensitive' };
    }

    if (status === 'ACTIVE' || status === 'INACTIVE') {
      where.status = status;
    }

    const [employees, total] = await Promise.all([
      prisma.employeeProfile.findMany({
        where,
        include: {
          user: true,
          permissions: true,
          _count: {
            select: {
              permissions: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.employeeProfile.count({ where })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/employees/index', {
      title: 'Staff & Employee Management | Admin',
      employees,
      pagination,
      search: search || '',
      department: department || '',
      status: status || ''
    });
  } catch (error) {
    next(error);
  }
}

async function renderCreateEmployee(req, res) {
  const groupedPermissions = getGroupedPermissions();
  res.render('admin/employees/create', {
    title: 'Add New Employee Staff | Admin',
    groupedPermissions,
    formData: {}
  });
}

async function handleCreateEmployee(req, res, next) {
  const { name, email, employeeId, phone, department, designation, password, permissions } = req.body;
  const groupedPermissions = getGroupedPermissions();

  try {
    if (!name || !email || !employeeId || !department || !designation || !password) {
      throw new Error('Please fill in all required fields marked with an asterisk (*).');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
    if (existingUser) {
      throw new Error('An account with this email address already exists.');
    }

    const existingEmp = await prisma.employeeProfile.findUnique({
      where: { employee_id: employeeId.trim() }
    });
    if (existingEmp) {
      throw new Error('An employee with this Employee ID already exists.');
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Normalize permissions array
    const assignedPerms = Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []);

    const createdEmployee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password_hash,
          role: 'EMPLOYEE',
          phone: phone ? phone.trim() : null,
          is_active: true
        }
      });

      const empProfile = await tx.employeeProfile.create({
        data: {
          user_id: user.id,
          employee_id: employeeId.trim(),
          department: department.trim(),
          designation: designation.trim(),
          phone: phone ? phone.trim() : null,
          status: 'ACTIVE'
        }
      });

      if (assignedPerms.length > 0) {
        await tx.employeePermission.createMany({
          data: assignedPerms.map(p => ({
            employee_id: empProfile.id,
            permission: p
          }))
        });
      }

      return { user, empProfile };
    });

    await logActivity({
      userId: req.user.id,
      action: 'EMPLOYEE_CREATED',
      entity: 'EmployeeProfile',
      entityId: createdEmployee.empProfile.id,
      details: `Created staff member ${name} (${employeeId}) with ${assignedPerms.length} permissions.`
    });

    setFlash(req, 'success', `Staff member "${name}" created successfully with ${assignedPerms.length} assigned permissions.`);
    res.redirect('/admin/employees');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.render('admin/employees/create', {
      title: 'Add New Employee Staff | Admin',
      groupedPermissions,
      formData: req.body
    });
  }
}

async function renderManagePermissions(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const employee = await prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: true,
        permissions: true
      }
    });

    if (!employee) {
      setFlash(req, 'error', 'Employee record not found.');
      return res.redirect('/admin/employees');
    }

    const groupedPermissions = getGroupedPermissions();
    const activePermKeys = employee.permissions.map(p => p.permission);

    res.render('admin/employees/permissions', {
      title: `Manage Permissions: ${employee.user.name} | Admin`,
      employee,
      groupedPermissions,
      activePermKeys
    });
  } catch (error) {
    next(error);
  }
}

async function handleUpdatePermissions(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { permissions } = req.body;

    const employee = await prisma.employeeProfile.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      setFlash(req, 'error', 'Employee record not found.');
      return res.redirect('/admin/employees');
    }

    const assignedPerms = Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []);

    await prisma.$transaction(async (tx) => {
      // Clear old permissions
      await tx.employeePermission.deleteMany({
        where: { employee_id: id }
      });

      // Insert new permissions
      if (assignedPerms.length > 0) {
        await tx.employeePermission.createMany({
          data: assignedPerms.map(p => ({
            employee_id: id,
            permission: p
          }))
        });
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'PERMISSIONS_UPDATED',
      entity: 'EmployeeProfile',
      entityId: id,
      details: `Updated permissions for ${employee.user.name}: assigned ${assignedPerms.length} capabilities.`
    });

    setFlash(req, 'success', `Permissions updated for ${employee.user.name}. ${assignedPerms.length} capabilities active.`);
    res.redirect('/admin/employees');
  } catch (error) {
    next(error);
  }
}

async function toggleEmployeeStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const employee = await prisma.employeeProfile.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      setFlash(req, 'error', 'Employee not found.');
      return res.redirect('/admin/employees');
    }

    const newStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const isUserActive = newStatus === 'ACTIVE';

    await prisma.$transaction([
      prisma.employeeProfile.update({
        where: { id },
        data: { status: newStatus }
      }),
      prisma.user.update({
        where: { id: employee.user_id },
        data: { is_active: isUserActive }
      })
    ]);

    await logActivity({
      userId: req.user.id,
      action: 'EMPLOYEE_STATUS_TOGGLED',
      entity: 'EmployeeProfile',
      entityId: id,
      details: `Set status of ${employee.user.name} (${employee.employee_id}) to ${newStatus}.`
    });

    setFlash(req, 'success', `Employee account "${employee.user.name}" is now ${newStatus}.`);
    res.redirect('/admin/employees');
  } catch (error) {
    next(error);
  }
}

async function viewEmployeeLogs(req, res, next) {
  try {
    const { employeeId, action } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 20);

    const where = {};

    if (employeeId) {
      where.user_id = parseInt(employeeId, 10);
    }

    if (action && action.trim()) {
      where.action = { contains: action.trim(), mode: 'insensitive' };
    }

    const [logs, total, allEmployees] = await Promise.all([
      prisma.employeeActivityLog.findMany({
        where,
        include: {
          user: {
            include: { employee_profile: true }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.employeeActivityLog.count({ where }),
      prisma.employeeProfile.findMany({
        include: { user: true },
        orderBy: { employee_id: 'asc' }
      })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/employees/logs', {
      title: 'Staff Audit Activity Logs | Admin',
      logs,
      pagination,
      allEmployees,
      selectedEmployeeId: employeeId || '',
      selectedAction: action || ''
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  renderEmployeeDashboard,
  listEmployees,
  renderCreateEmployee,
  handleCreateEmployee,
  renderManagePermissions,
  handleUpdatePermissions,
  toggleEmployeeStatus,
  viewEmployeeLogs
};
