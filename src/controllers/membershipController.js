const { prisma } = require('../config/database');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');

async function listMemberships(req, res, next) {
  try {
    const { search, feeStatus } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 15);

    const where = {};

    if (feeStatus && ['PAID', 'PENDING', 'UNDER_VERIFICATION'].includes(feeStatus.toUpperCase())) {
      where.fee_status = feeStatus.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.student = {
        OR: [
          { student_id: { contains: q, mode: 'insensitive' } },
          { enrollment_number: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } }
        ]
      };
    }

    const [memberships, total, paidCount, pendingCount, verificationCount] = await Promise.all([
      prisma.studentMembership.findMany({
        where,
        include: {
          student: {
            include: { user: true }
          }
        },
        orderBy: [
          { fee_status: 'asc' }, // UNDER_VERIFICATION and PENDING first
          { valid_until: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.studentMembership.count({ where }),
      prisma.studentMembership.count({ where: { fee_status: 'PAID' } }),
      prisma.studentMembership.count({ where: { fee_status: 'PENDING' } }),
      prisma.studentMembership.count({ where: { fee_status: 'UNDER_VERIFICATION' } })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/memberships/index', {
      title: 'Student Memberships & Fee Management | Admin',
      memberships,
      pagination,
      search: search || '',
      selectedFeeStatus: feeStatus || '',
      paidCount,
      pendingCount,
      verificationCount
    });
  } catch (error) {
    next(error);
  }
}

async function markFeePaid(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { paymentMethod, receiptNumber, notes } = req.body;

    const membership = await prisma.studentMembership.findUnique({
      where: { id },
      include: {
        student: { include: { user: true } }
      }
    });

    if (!membership) {
      setFlash(req, 'error', 'Membership record not found.');
      return res.redirect('/memberships/admin');
    }

    const receipt = receiptNumber && receiptNumber.trim() 
      ? receiptNumber.trim() 
      : `REC-${Date.now().toString().slice(-6)}`;

    // Extend validity if needed
    const now = new Date();
    const currentExpiry = new Date(membership.valid_until);
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.studentMembership.update({
      where: { id },
      data: {
        fee_status: 'PAID',
        paid_at: now,
        valid_until: newExpiry,
        payment_method: paymentMethod || 'Counter Cash / UPI',
        receipt_number: receipt,
        rejection_reason: null,
        notes: notes || undefined
      }
    });

    // Notify student
    await prisma.notification.create({
      data: {
        user_id: membership.student.user_id,
        title: 'Membership Fee Payment Confirmed',
        message: `Your monthly membership fee of ₹${membership.monthly_fee} has been confirmed. Valid until: ${newExpiry.toLocaleDateString('en-IN')}. Receipt: ${receipt}`,
        type: 'GENERAL'
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'MEMBERSHIP_FEE_PAID',
      entity: 'StudentMembership',
      entityId: id,
      details: `Collected ₹${membership.monthly_fee} monthly membership fee for student ${membership.student.user.name} (${membership.student.student_id}). Receipt: ${receipt}`
    });

    setFlash(req, 'success', `Fee marked as PAID for ${membership.student.user.name}. Receipt: ${receipt}`);
    res.redirect('/memberships/admin');
  } catch (error) {
    next(error);
  }
}

async function approveUpiPayment(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const membership = await prisma.studentMembership.findUnique({
      where: { id },
      include: {
        student: { include: { user: true } }
      }
    });

    if (!membership) {
      setFlash(req, 'error', 'Membership record not found.');
      return res.redirect('/memberships/admin');
    }

    const receipt = `REC-UPI-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const currentExpiry = new Date(membership.valid_until);
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.studentMembership.update({
      where: { id },
      data: {
        fee_status: 'PAID',
        paid_at: now,
        valid_until: newExpiry,
        payment_method: 'UPI Online',
        receipt_number: receipt,
        rejection_reason: null
      }
    });

    // Notify student
    await prisma.notification.create({
      data: {
        user_id: membership.student.user_id,
        title: 'UPI Payment Approved & Pass Active!',
        message: `Your UPI payment (UTR: ${membership.utr_number || 'Verified'}) of ₹${membership.monthly_fee} has been verified and approved. Your library membership pass is active until ${newExpiry.toLocaleDateString('en-IN')}. Receipt: ${receipt}`,
        type: 'REQUEST_APPROVED'
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'UPI_PAYMENT_APPROVED',
      entity: 'StudentMembership',
      entityId: id,
      details: `Approved UPI payment proof (UTR: ${membership.utr_number}) of ₹${membership.monthly_fee} for student ${membership.student.user.name} (${membership.student.student_id}). Receipt: ${receipt}`
    });

    setFlash(req, 'success', `UPI Payment verified and approved for ${membership.student.user.name}! Receipt: ${receipt}`);
    res.redirect('/memberships/admin');
  } catch (error) {
    next(error);
  }
}

async function rejectUpiPayment(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { rejectionReason } = req.body;

    const membership = await prisma.studentMembership.findUnique({
      where: { id },
      include: {
        student: { include: { user: true } }
      }
    });

    if (!membership) {
      setFlash(req, 'error', 'Membership record not found.');
      return res.redirect('/memberships/admin');
    }

    const reason = rejectionReason && rejectionReason.trim() 
      ? rejectionReason.trim() 
      : 'Invalid or unverified transaction UTR / Screenshot';

    await prisma.studentMembership.update({
      where: { id },
      data: {
        fee_status: 'PENDING',
        rejection_reason: reason
      }
    });

    // Notify student
    await prisma.notification.create({
      data: {
        user_id: membership.student.user_id,
        title: 'UPI Payment Verification Failed',
        message: `Your UPI payment proof for monthly fee (UTR: ${membership.utr_number || 'N/A'}) was rejected: "${reason}". Please pay again via UPI with valid proof.`,
        type: 'REQUEST_REJECTED'
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'UPI_PAYMENT_REJECTED',
      entity: 'StudentMembership',
      entityId: id,
      details: `Rejected UPI payment proof for student ${membership.student.user.name} (${membership.student.student_id}). Reason: ${reason}`
    });

    setFlash(req, 'warning', `UPI Payment rejected for ${membership.student.user.name}. Student has been notified.`);
    res.redirect('/memberships/admin');
  } catch (error) {
    next(error);
  }
}

async function renewMembership(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const membership = await prisma.studentMembership.findUnique({
      where: { id },
      include: { student: { include: { user: true } } }
    });

    if (!membership) {
      setFlash(req, 'error', 'Membership not found.');
      return res.redirect('/memberships/admin');
    }

    const currentExpiry = new Date(membership.valid_until);
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.studentMembership.update({
      where: { id },
      data: {
        valid_until: newExpiry,
        fee_status: 'PAID',
        paid_at: new Date(),
        receipt_number: `REC-RNW-${Date.now().toString().slice(-6)}`
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'MEMBERSHIP_RENEWED',
      entity: 'StudentMembership',
      entityId: id,
      details: `Renewed monthly membership for ${membership.student.user.name} until ${newExpiry.toLocaleDateString('en-IN')}`
    });

    setFlash(req, 'success', `Membership renewed for 30 days for ${membership.student.user.name}.`);
    res.redirect('/memberships/admin');
  } catch (error) {
    next(error);
  }
}

async function renderStudentMembership(req, res, next) {
  try {
    const student = req.student;
    if (!student) {
      return res.redirect('/login');
    }

    const memberships = await prisma.studentMembership.findMany({
      where: { student_id: student.id },
      orderBy: { valid_until: 'desc' }
    });

    const activeMembership = memberships.length > 0 ? memberships[0] : null;

    res.render('student/membership', {
      title: 'My Library Membership & Fee Status',
      activeMembership,
      memberships
    });
  } catch (error) {
    next(error);
  }
}

async function submitStudentUpiPayment(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { utrNumber, paymentApp, notes } = req.body;
    const student = req.student;

    if (!student) {
      setFlash(req, 'error', 'Unauthorized access.');
      return res.redirect('/login');
    }

    const membership = await prisma.studentMembership.findFirst({
      where: { id, student_id: student.id }
    });

    if (!membership) {
      setFlash(req, 'error', 'Membership record not found.');
      return res.redirect('/memberships/student');
    }

    const cleanUtr = utrNumber ? utrNumber.toString().replace(/\D/g, '').trim() : '';
    if (!cleanUtr || cleanUtr.length !== 12) {
      setFlash(req, 'error', 'Invalid UTR: Please enter exactly 12 numeric digits (0-9) from your UPI transaction receipt.');
      return res.redirect('/memberships/student');
    }

    const screenshotUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;

    await prisma.studentMembership.update({
      where: { id },
      data: {
        fee_status: 'UNDER_VERIFICATION',
        utr_number: cleanUtr,
        screenshot_url: screenshotUrl,
        submitted_at: new Date(),
        payment_method: paymentApp ? `UPI (${paymentApp})` : 'UPI Online',
        notes: notes ? notes.trim() : undefined,
        rejection_reason: null
      }
    });

    // Notify Admins / Staff
    const staffUsers = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'EMPLOYEE'] },
        is_active: true
      },
      select: { id: true }
    });

    for (const staff of staffUsers) {
      await prisma.notification.create({
        data: {
          user_id: staff.id,
          title: 'New UPI Fee Payment Proof',
          message: `Student ${req.user.name} (${student.student_id}) submitted UPI proof with UTR: ${utrNumber.trim()} for ₹${membership.monthly_fee}. Please verify in Memberships ledger.`,
          type: 'GENERAL'
        }
      });
    }

    setFlash(req, 'success', 'UPI Payment proof submitted successfully! Verification is underway by library accounts desk.');
    res.redirect('/memberships/student');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listMemberships,
  markFeePaid,
  approveUpiPayment,
  rejectUpiPayment,
  renewMembership,
  renderStudentMembership,
  submitStudentUpiPayment
};
