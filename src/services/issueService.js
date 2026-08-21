const { prisma } = require('../config/database');
const { getSystemSettings } = require('../config/settings');
const { calculateDueDate, calculateOverdueDays } = require('../utils/dateUtils');
const { createNotification, notifyAdmins } = require('./notificationService');

async function requestBook(studentProfileId, bookId) {
  const settings = await getSystemSettings();
  const maxBooks = settings.max_books_per_student;

  const student = await prisma.studentProfile.findUnique({
    where: { id: parseInt(studentProfileId, 10) },
    include: { user: true }
  });

  if (!student || !student.user.is_active) {
    throw new Error('Student account is not active or not found.');
  }

  const book = await prisma.book.findUnique({
    where: { id: parseInt(bookId, 10) }
  });

  if (!book || book.is_archived) {
    throw new Error('This book is not available in the library catalog.');
  }

  if (book.available_copies <= 0) {
    throw new Error('All copies of this book are currently issued. Please check back later.');
  }

  // Count student active issues and pending requests
  const [activeIssuesCount, pendingRequestsCount] = await Promise.all([
    prisma.issuedBook.count({
      where: {
        student_id: student.id,
        status: { in: ['ISSUED', 'OVERDUE'] }
      }
    }),
    prisma.bookIssueRequest.count({
      where: {
        student_id: student.id,
        status: 'PENDING'
      }
    })
  ]);

  if (activeIssuesCount + pendingRequestsCount >= maxBooks) {
    throw new Error(`You have reached the maximum allowed limit of ${maxBooks} active/requested books.`);
  }

  // Check if student already has this book issued or requested
  const existingIssue = await prisma.issuedBook.findFirst({
    where: {
      student_id: student.id,
      book_id: book.id,
      status: { in: ['ISSUED', 'OVERDUE'] }
    }
  });

  if (existingIssue) {
    throw new Error('You already have an active copy of this book issued.');
  }

  const existingRequest = await prisma.bookIssueRequest.findFirst({
    where: {
      student_id: student.id,
      book_id: book.id,
      status: 'PENDING'
    }
  });

  if (existingRequest) {
    throw new Error('You already have a pending issue request for this book.');
  }

  // Create issue request
  const request = await prisma.bookIssueRequest.create({
    data: {
      student_id: student.id,
      book_id: book.id,
      status: 'PENDING'
    },
    include: {
      book: true,
      student: { include: { user: true } }
    }
  });

  // Notify admins
  await notifyAdmins({
    title: 'New Book Issue Request',
    message: `${student.user.name} (${student.student_id}) requested "${book.title}".`,
    type: 'BOOK_REQUEST'
  });

  return request;
}

async function approveRequest(requestId, adminId) {
  const settings = await getSystemSettings();
  const loanDays = settings.loan_period_days;

  return await prisma.$transaction(async (tx) => {
    const request = await tx.bookIssueRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        book: true,
        student: { include: { user: true } }
      }
    });

    if (!request || request.status !== 'PENDING') {
      throw new Error('Request is no longer pending or does not exist.');
    }

    const book = await tx.book.findUnique({
      where: { id: request.book_id }
    });

    if (!book || book.available_copies <= 0) {
      throw new Error('No available copies left for this book to approve request.');
    }

    // Decrement available copies
    await tx.book.update({
      where: { id: book.id },
      data: { available_copies: { decrement: 1 } }
    });

    const now = new Date();
    const dueDate = calculateDueDate(now, loanDays);

    // Update request
    const updatedRequest = await tx.bookIssueRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewed_by: parseInt(adminId, 10),
        reviewed_at: now
      }
    });

    // Create IssuedBook record
    const issueRecord = await tx.issuedBook.create({
      data: {
        student_id: request.student_id,
        book_id: request.book_id,
        issued_by: parseInt(adminId, 10),
        issue_date: now,
        due_date: dueDate,
        status: 'ISSUED',
        renewal_count: 0
      }
    });

    // Notify student
    await tx.notification.create({
      data: {
        user_id: request.student.user_id,
        title: 'Book Request Approved',
        message: `Your request for "${book.title}" was approved. Due date: ${dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`,
        type: 'REQUEST_APPROVED',
        is_read: false
      }
    });

    return { request: updatedRequest, issue: issueRecord };
  });
}

async function rejectRequest(requestId, adminId, reason = 'Request rejected by librarian.') {
  const request = await prisma.bookIssueRequest.findUnique({
    where: { id: parseInt(requestId, 10) },
    include: {
      book: true,
      student: { include: { user: true } }
    }
  });

  if (!request || request.status !== 'PENDING') {
    throw new Error('Request is not in pending state.');
  }

  const updatedRequest = await prisma.bookIssueRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      reviewed_by: parseInt(adminId, 10),
      reviewed_at: new Date(),
      rejection_reason: reason.trim()
    }
  });

  await createNotification({
    userId: request.student.user_id,
    title: 'Book Request Rejected',
    message: `Your request for "${request.book.title}" was declined. Reason: ${reason.trim()}`,
    type: 'REQUEST_REJECTED'
  });

  return updatedRequest;
}

async function directIssueBook(studentId, bookId, adminId) {
  const settings = await getSystemSettings();
  const maxBooks = settings.max_books_per_student;
  const loanDays = settings.loan_period_days;

  return await prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({
      where: { id: parseInt(studentId, 10) },
      include: { user: true }
    });

    if (!student || !student.user.is_active) {
      throw new Error('Student is inactive or does not exist.');
    }

    const book = await tx.book.findUnique({
      where: { id: parseInt(bookId, 10) }
    });

    if (!book || book.available_copies <= 0) {
      throw new Error('No copies available for this book.');
    }

    const activeIssuesCount = await tx.issuedBook.count({
      where: {
        student_id: student.id,
        status: { in: ['ISSUED', 'OVERDUE'] }
      }
    });

    if (activeIssuesCount >= maxBooks) {
      throw new Error(`Student has reached maximum allowed active issues (${maxBooks}).`);
    }

    const existingIssue = await tx.issuedBook.findFirst({
      where: {
        student_id: student.id,
        book_id: book.id,
        status: { in: ['ISSUED', 'OVERDUE'] }
      }
    });

    if (existingIssue) {
      throw new Error('Student already has an active issue of this book.');
    }

    // Decrement available copy
    await tx.book.update({
      where: { id: book.id },
      data: { available_copies: { decrement: 1 } }
    });

    const now = new Date();
    const dueDate = calculateDueDate(now, loanDays);

    const issueRecord = await tx.issuedBook.create({
      data: {
        student_id: student.id,
        book_id: book.id,
        issued_by: parseInt(adminId, 10),
        issue_date: now,
        due_date: dueDate,
        status: 'ISSUED',
        renewal_count: 0
      }
    });

    await tx.notification.create({
      data: {
        user_id: student.user_id,
        title: 'Book Issued',
        message: `"${book.title}" was issued to you. Return due date: ${dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`,
        type: 'REQUEST_APPROVED',
        is_read: false
      }
    });

    return issueRecord;
  });
}

async function processReturn(issueId) {
  const settings = await getSystemSettings();
  const finePerDay = settings.fine_per_day;

  return await prisma.$transaction(async (tx) => {
    const issue = await tx.issuedBook.findUnique({
      where: { id: parseInt(issueId, 10) },
      include: {
        book: true,
        student: { include: { user: true } }
      }
    });

    if (!issue) {
      throw new Error('Issue transaction record not found.');
    }

    if (issue.status === 'RETURNED') {
      throw new Error('This book has already been marked as returned.');
    }

    const returnDate = new Date();
    const overdueDays = calculateOverdueDays(issue.due_date, returnDate);

    // Update Issue status to RETURNED
    const updatedIssue = await tx.issuedBook.update({
      where: { id: issue.id },
      data: {
        status: 'RETURNED',
        returned_date: returnDate
      }
    });

    // Increment available copies safely (not exceeding total_copies)
    const book = await tx.book.findUnique({ where: { id: issue.book_id } });
    if (book) {
      const newAvailable = Math.min(book.total_copies, book.available_copies + 1);
      await tx.book.update({
        where: { id: book.id },
        data: { available_copies: newAvailable }
      });
    }

    let generatedFine = null;
    if (overdueDays > 0) {
      const totalFine = parseFloat((overdueDays * finePerDay).toFixed(2));
      
      // Check if fine already created for this issue
      const existingFine = await tx.fine.findFirst({
        where: { issue_id: issue.id }
      });

      if (!existingFine) {
        generatedFine = await tx.fine.create({
          data: {
            issue_id: issue.id,
            student_id: issue.student_id,
            amount: totalFine,
            reason: `Overdue penalty: ${overdueDays} day(s) past due date (${settings.fine_per_day}/day)`,
            status: 'UNPAID'
          }
        });

        await tx.notification.create({
          data: {
            user_id: issue.student.user_id,
            title: 'Overdue Fine Assessed',
            message: `A fine of $${totalFine.toFixed(2)} was generated for late return of "${issue.book.title}" (${overdueDays} days overdue).`,
            type: 'FINE',
            is_read: false
          }
        });
      }
    } else {
      await tx.notification.create({
        data: {
          user_id: issue.student.user_id,
          title: 'Book Returned',
          message: `"${issue.book.title}" was returned successfully. Thank you!`,
          type: 'GENERAL',
          is_read: false
        }
      });
    }

    return { issue: updatedIssue, fine: generatedFine, overdueDays };
  });
}

async function renewBook(issueId, studentId = null) {
  const settings = await getSystemSettings();
  const renewalLimit = settings.renewal_limit;
  const loanDays = settings.loan_period_days;

  const issue = await prisma.issuedBook.findUnique({
    where: { id: parseInt(issueId, 10) },
    include: {
      book: true,
      student: { include: { user: true } }
    }
  });

  if (!issue) {
    throw new Error('Issue record not found.');
  }

  if (studentId && issue.student_id !== parseInt(studentId, 10)) {
    throw new Error('Unauthorized renewal attempt.');
  }

  if (issue.status === 'RETURNED') {
    throw new Error('Cannot renew an already returned book.');
  }

  if (issue.renewal_count >= renewalLimit) {
    throw new Error(`Maximum renewal limit (${renewalLimit} times) reached for this book.`);
  }

  // Calculate new due date (extend from current due date or now, whichever is later)
  const baseDate = new Date(issue.due_date) > new Date() ? new Date(issue.due_date) : new Date();
  const newDueDate = calculateDueDate(baseDate, loanDays);

  const updatedIssue = await prisma.issuedBook.update({
    where: { id: issue.id },
    data: {
      due_date: newDueDate,
      renewal_count: { increment: 1 },
      status: 'ISSUED' // Reset to ISSUED if previously overdue
    }
  });

  await createNotification({
    userId: issue.student.user_id,
    title: 'Book Borrowing Renewed',
    message: `Borrowing period for "${issue.book.title}" renewed. New due date is ${newDueDate.toLocaleDateString('en-IN')}.`,
    type: 'GENERAL'
  });

  return updatedIssue;
}

async function syncOverdueStatuses() {
  const now = new Date();
  try {
    const overdueIssues = await prisma.issuedBook.findMany({
      where: {
        status: 'ISSUED',
        due_date: { lt: now }
      },
      include: {
        student: { include: { user: true } },
        book: true
      }
    });

    for (const issue of overdueIssues) {
      await prisma.issuedBook.update({
        where: { id: issue.id },
        data: { status: 'OVERDUE' }
      });

      // Send overdue notification if not sent in last 2 days
      await createNotification({
        userId: issue.student.user_id,
        title: 'Book Overdue Alert',
        message: `Your issued book "${issue.book.title}" is overdue. Please return it promptly to the library desk to avoid fines.`,
        type: 'BOOK_OVERDUE'
      });
    }
  } catch (err) {
    console.error('Error syncing overdue statuses:', err.message);
  }
}

module.exports = {
  requestBook,
  approveRequest,
  rejectRequest,
  directIssueBook,
  processReturn,
  renewBook,
  syncOverdueStatuses
};
