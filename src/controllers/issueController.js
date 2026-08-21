const { prisma } = require('../config/database');
const issueService = require('../services/issueService');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');

async function listAdminIssues(req, res, next) {
  try {
    await issueService.syncOverdueStatuses();
    const { status = 'ISSUED', search } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 15);

    const where = {};
    if (status && ['ISSUED', 'OVERDUE', 'RETURNED'].includes(status)) {
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

    const [issues, total] = await Promise.all([
      prisma.issuedBook.findMany({
        where,
        include: {
          book: { include: { author: true, category: true } },
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

    res.render('admin/issues/index', {
      title: 'Book Circulation & Issued Books | Library Central',
      issues,
      pagination,
      selectedStatus: status,
      search: search || ''
    });
  } catch (error) {
    next(error);
  }
}

async function renderDirectIssue(req, res, next) {
  try {
    const { bookId } = req.query;
    const [books, students] = await Promise.all([
      prisma.book.findMany({
        where: { available_copies: { gt: 0 } },
        include: { author: true },
        orderBy: { title: 'asc' }
      }),
      prisma.studentProfile.findMany({
        where: { user: { is_active: true } },
        include: { user: true },
        orderBy: { student_id: 'asc' }
      })
    ]);

    res.render('admin/issues/create', {
      title: 'Direct Issue Book | Library Management System',
      books,
      students,
      query: { bookId }
    });
  } catch (error) {
    next(error);
  }
}

async function handleDirectIssue(req, res, next) {
  const { studentId, bookId, notes } = req.body;
  try {
    const issue = await issueService.issueBookDirectly({
      studentId: parseInt(studentId, 10),
      bookId: parseInt(bookId, 10),
      adminUserId: req.user.id,
      notes
    });

    await logActivity({
      userId: req.user.id,
      action: 'BOOK_ISSUED_DIRECT',
      entity: 'IssuedBook',
      entityId: issue.id,
      details: `Issued book #${bookId} directly to student profile #${studentId}. Due: ${issue.due_date.toLocaleDateString('en-IN')}`
    });

    setFlash(req, 'success', `Book issued successfully! Return due date: ${issue.due_date.toLocaleDateString('en-IN')}`);
    res.redirect('/issues/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect('/issues/admin/create');
  }
}

async function handleProcessReturn(req, res, next) {
  const issueId = parseInt(req.params.id, 10);
  try {
    const result = await issueService.processReturn(issueId);

    await logActivity({
      userId: req.user.id,
      action: 'RETURN_PROCESSED',
      entity: 'IssuedBook',
      entityId: issueId,
      details: `Accepted book return for issue #${issueId}.${result.fine ? ` Assessed fine: ₹${result.fine.amount}` : ''}`
    });

    if (result.fine) {
      setFlash(req, 'warning', `Book returned successfully. Overdue penalty of ₹${Number(result.fine.amount).toFixed(2)} (${result.overdueDays} days) assessed to student ledger.`);
    } else {
      setFlash(req, 'success', 'Book returned on time and inventory copy restored successfully!');
    }
    res.redirect(req.headers.referer || '/issues/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/issues/admin');
  }
}

async function handleRenewBook(req, res, next) {
  const issueId = parseInt(req.params.id, 10);
  try {
    const studentProfileId = req.student ? req.student.id : null;
    const renewed = await issueService.renewBook(issueId, studentProfileId);

    await logActivity({
      userId: req.user.id,
      action: 'BOOK_RENEWED',
      entity: 'IssuedBook',
      entityId: issueId,
      details: `Extended issue #${issueId}. New due date: ${renewed.due_date.toLocaleDateString('en-IN')}`
    });

    setFlash(req, 'success', `Book renewed successfully! New due date is ${renewed.due_date.toLocaleDateString('en-IN')}.`);
    res.redirect(req.headers.referer || '/issues/student/my-books');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/issues/student/my-books');
  }
}

async function listStudentIssuedBooks(req, res, next) {
  try {
    await issueService.syncOverdueStatuses();
    const issuedBooks = await prisma.issuedBook.findMany({
      where: {
        student_id: req.student.id,
        status: { in: ['ISSUED', 'OVERDUE'] }
      },
      include: {
        book: { include: { author: true, category: true } }
      },
      orderBy: { due_date: 'asc' }
    });

    res.render('student/my-books', {
      title: 'My Borrowed Books | Library Management System',
      issuedBooks
    });
  } catch (error) {
    next(error);
  }
}

async function listStudentHistory(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req, 10);

    const [history, total] = await Promise.all([
      prisma.issuedBook.findMany({
        where: {
          student_id: req.student.id,
          status: 'RETURNED'
        },
        include: {
          book: { include: { author: true } },
          fines: true
        },
        orderBy: { returned_date: 'desc' },
        skip,
        take: limit
      }),
      prisma.issuedBook.count({
        where: {
          student_id: req.student.id,
          status: 'RETURNED'
        }
      })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('student/history', {
      title: 'My Borrowing History | Library Management System',
      history,
      pagination
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAdminIssues,
  renderDirectIssue,
  handleDirectIssue,
  handleProcessReturn,
  handleRenewBook,
  listStudentIssuedBooks,
  listStudentHistory
};
