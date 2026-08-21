const { prisma } = require('../config/database');
const { createNotification } = require('./notificationService');

async function getFines({ status, studentId, skip = 0, limit = 10 }) {
  const where = {};

  if (status && ['UNPAID', 'PAID', 'WAIVED', 'UNDER_VERIFICATION'].includes(status)) {
    where.status = status;
  }

  if (studentId) {
    where.student_id = parseInt(studentId, 10);
  }

  const [fines, total, unpaidCount, verificationCount, paidCount, waivedCount] = await Promise.all([
    prisma.fine.findMany({
      where,
      include: {
        student: { include: { user: true } },
        issue: { include: { book: true } }
      },
      orderBy: [
        { status: 'asc' },
        { created_at: 'desc' }
      ],
      skip,
      take: limit
    }),
    prisma.fine.count({ where }),
    prisma.fine.count({ where: { status: 'UNPAID', ...(studentId ? { student_id: parseInt(studentId, 10) } : {}) } }),
    prisma.fine.count({ where: { status: 'UNDER_VERIFICATION', ...(studentId ? { student_id: parseInt(studentId, 10) } : {}) } }),
    prisma.fine.count({ where: { status: 'PAID', ...(studentId ? { student_id: parseInt(studentId, 10) } : {}) } }),
    prisma.fine.count({ where: { status: 'WAIVED', ...(studentId ? { student_id: parseInt(studentId, 10) } : {}) } })
  ]);

  return { fines, total, unpaidCount, verificationCount, paidCount, waivedCount };
}

async function markFinePaid(fineId, paymentMethod = 'Counter Cash / UPI') {
  const fine = await prisma.fine.findUnique({
    where: { id: parseInt(fineId, 10) },
    include: {
      student: { include: { user: true } },
      issue: { include: { book: true } }
    }
  });

  if (!fine) {
    throw new Error('Fine record not found.');
  }

  if (fine.status === 'PAID') {
    throw new Error('Fine has already been marked as paid.');
  }

  const receipt = `REC-FINE-${Date.now().toString().slice(-6)}`;

  const updatedFine = await prisma.fine.update({
    where: { id: fine.id },
    data: {
      status: 'PAID',
      paid_at: new Date(),
      payment_method: paymentMethod,
      receipt_number: receipt,
      rejection_reason: null
    }
  });

  await createNotification({
    userId: fine.student.user_id,
    title: 'Fine Payment Settled',
    message: `Payment of ₹${Number(fine.amount).toFixed(2)} received for "${fine.issue.book.title}". Receipt: ${receipt}`,
    type: 'FINE'
  });

  return updatedFine;
}

async function submitStudentUpiFinePayment(fineId, studentId, { utrNumber, paymentApp, screenshotUrl }) {
  const fine = await prisma.fine.findFirst({
    where: { id: parseInt(fineId, 10), student_id: parseInt(studentId, 10) },
    include: {
      student: { include: { user: true } },
      issue: { include: { book: true } }
    }
  });

  if (!fine) {
    throw new Error('Fine record not found.');
  }

  if (fine.status === 'PAID') {
    throw new Error('Fine has already been paid.');
  }

  const cleanUtr = utrNumber ? utrNumber.toString().replace(/\D/g, '').trim() : '';
  if (!cleanUtr || cleanUtr.length !== 12) {
    throw new Error('Invalid UTR: Please enter exactly 12 numeric digits (0-9) from your UPI receipt.');
  }

  const updatedFine = await prisma.fine.update({
    where: { id: fine.id },
    data: {
      status: 'UNDER_VERIFICATION',
      utr_number: cleanUtr,
      screenshot_url: screenshotUrl,
      submitted_at: new Date(),
      payment_method: paymentApp ? `UPI (${paymentApp})` : 'UPI Online',
      rejection_reason: null
    }
  });

  // Notify Admins & Staff
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EMPLOYEE'] }, is_active: true },
    select: { id: true }
  });

  for (const staff of staffUsers) {
    await createNotification({
      userId: staff.id,
      title: 'New Fine UPI Payment Proof',
      message: `Student ${fine.student.user.name} submitted UPI proof with UTR ${cleanUtr} for ₹${fine.amount} fine on "${fine.issue.book.title}". Please verify.`,
      type: 'FINE'
    });
  }

  return updatedFine;
}

async function approveUpiFine(fineId) {
  const fine = await prisma.fine.findUnique({
    where: { id: parseInt(fineId, 10) },
    include: {
      student: { include: { user: true } },
      issue: { include: { book: true } }
    }
  });

  if (!fine) {
    throw new Error('Fine record not found.');
  }

  const receipt = `REC-FINE-UPI-${Date.now().toString().slice(-6)}`;

  const updatedFine = await prisma.fine.update({
    where: { id: fine.id },
    data: {
      status: 'PAID',
      paid_at: new Date(),
      payment_method: 'UPI Online',
      receipt_number: receipt,
      rejection_reason: null
    }
  });

  await createNotification({
    userId: fine.student.user_id,
    title: 'UPI Fine Payment Approved!',
    message: `Your UPI payment (UTR: ${fine.utr_number || 'Verified'}) of ₹${Number(fine.amount).toFixed(2)} for "${fine.issue.book.title}" has been verified and settled. Receipt: ${receipt}`,
    type: 'FINE'
  });

  return updatedFine;
}

async function rejectUpiFine(fineId, rejectionReason) {
  const fine = await prisma.fine.findUnique({
    where: { id: parseInt(fineId, 10) },
    include: {
      student: { include: { user: true } },
      issue: { include: { book: true } }
    }
  });

  if (!fine) {
    throw new Error('Fine record not found.');
  }

  const reason = rejectionReason && rejectionReason.trim()
    ? rejectionReason.trim()
    : 'Invalid or unverified transaction UTR / Screenshot';

  const updatedFine = await prisma.fine.update({
    where: { id: fine.id },
    data: {
      status: 'UNPAID',
      rejection_reason: reason
    }
  });

  await createNotification({
    userId: fine.student.user_id,
    title: 'Fine UPI Payment Verification Failed',
    message: `Your UPI payment proof for "${fine.issue.book.title}" (UTR: ${fine.utr_number || 'N/A'}) was rejected: "${reason}". Please pay again via UPI with valid proof.`,
    type: 'FINE'
  });

  return updatedFine;
}

async function waiveFine(fineId) {
  const fine = await prisma.fine.findUnique({
    where: { id: parseInt(fineId, 10) },
    include: {
      student: { include: { user: true } },
      issue: { include: { book: true } }
    }
  });

  if (!fine) {
    throw new Error('Fine record not found.');
  }

  const updatedFine = await prisma.fine.update({
    where: { id: fine.id },
    data: {
      status: 'WAIVED'
    }
  });

  await createNotification({
    userId: fine.student.user_id,
    title: 'Fine Waived',
    message: `Fine penalty of ₹${Number(fine.amount).toFixed(2)} for "${fine.issue.book.title}" was waived by the librarian.`,
    type: 'FINE'
  });

  return updatedFine;
}

module.exports = {
  getFines,
  markFinePaid,
  submitStudentUpiFinePayment,
  approveUpiFine,
  rejectUpiFine,
  waiveFine
};
