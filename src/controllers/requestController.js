const { prisma } = require('../config/database');
const issueService = require('../services/issueService');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');

async function handleStudentRequest(req, res, next) {
  const bookId = parseInt(req.params.id || req.body.bookId, 10);
  try {
    if (!req.student) {
      setFlash(req, 'error', 'Student profile is required to request books.');
      return res.redirect('/books');
    }

    await issueService.requestBook(req.student.id, bookId);
    setFlash(req, 'success', 'Book issue request submitted successfully! Awaiting librarian approval.');
    res.redirect('/requests/student');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(`/books/${bookId}`);
  }
}

async function listStudentRequests(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req, 10);

    const [requests, total] = await Promise.all([
      prisma.bookIssueRequest.findMany({
        where: { student_id: req.student.id },
        include: {
          book: { include: { author: true, category: true } },
          reviewer: true
        },
        orderBy: { request_date: 'desc' },
        skip,
        take: limit
      }),
      prisma.bookIssueRequest.count({
        where: { student_id: req.student.id }
      })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('student/my-requests', {
      title: 'My Book Requests | Library Management System',
      requests,
      pagination
    });
  } catch (error) {
    next(error);
  }
}

async function listAdminRequests(req, res, next) {
  try {
    const { status = 'PENDING', search } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 15);

    const where = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { book: { title: { contains: q, mode: 'insensitive' } } },
        { student: { student_id: { contains: q, mode: 'insensitive' } } },
        { student: { user: { name: { contains: q, mode: 'insensitive' } } } }
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.bookIssueRequest.findMany({
        where,
        include: {
          book: { include: { author: true } },
          student: { include: { user: true } },
          reviewer: true
        },
        orderBy: { request_date: 'desc' },
        skip,
        take: limit
      }),
      prisma.bookIssueRequest.count({ where })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/requests/index', {
      title: 'Book Issue Requests | Library Central',
      requests,
      pagination,
      selectedStatus: status,
      search: search || ''
    });
  } catch (error) {
    next(error);
  }
}

async function handleApproveRequest(req, res, next) {
  const requestId = parseInt(req.params.id, 10);
  try {
    const result = await issueService.approveRequest(requestId, req.user.id);

    await logActivity({
      userId: req.user.id,
      action: 'REQUEST_APPROVED',
      entity: 'BookIssueRequest',
      entityId: requestId,
      details: `Approved book request #${requestId} for "${result.request.book?.title || 'Book'}"`
    });

    setFlash(req, 'success', `Request approved. Book issued with due date: ${result.issue.due_date.toLocaleDateString()}.`);
    res.redirect(req.headers.referer || '/requests/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/requests/admin');
  }
}

async function handleRejectRequest(req, res, next) {
  const requestId = parseInt(req.params.id, 10);
  const { reason } = req.body;
  try {
    await issueService.rejectRequest(requestId, req.user.id, reason);

    await logActivity({
      userId: req.user.id,
      action: 'REQUEST_REJECTED',
      entity: 'BookIssueRequest',
      entityId: requestId,
      details: `Declined book request #${requestId}. Reason: ${reason}`
    });

    setFlash(req, 'info', 'Book request rejected.');
    res.redirect(req.headers.referer || '/requests/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/requests/admin');
  }
}

module.exports = {
  handleStudentRequest,
  listStudentRequests,
  listAdminRequests,
  handleApproveRequest,
  handleRejectRequest
};
