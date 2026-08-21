const fineService = require('../services/fineService');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');

async function listAdminFines(req, res, next) {
  try {
    const { status = '', search } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 15);

    const { fines, total, unpaidCount, verificationCount, paidCount, waivedCount } = await fineService.getFines({
      status: status || undefined,
      search,
      skip,
      limit
    });

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('admin/fines/index', {
      title: 'Fine Ledger & Penalties | Library Central',
      fines,
      pagination,
      selectedStatus: status || '',
      search: search || '',
      unpaidCount,
      verificationCount,
      paidCount,
      waivedCount
    });
  } catch (error) {
    next(error);
  }
}

async function handlePayFine(req, res, next) {
  const fineId = parseInt(req.params.id, 10);
  try {
    const fine = await fineService.markFinePaid(fineId, 'Counter Cash / UPI');

    await logActivity({
      userId: req.user.id,
      action: 'FINE_PAID',
      entity: 'Fine',
      entityId: fineId,
      details: `Settled fine payment of ₹${fine.amount} for student ID ${fine.student_id}`
    });

    setFlash(req, 'success', `Fine payment of ₹${Number(fine.amount).toFixed(2)} recorded successfully.`);
    res.redirect(req.headers.referer || '/fines/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/fines/admin');
  }
}

async function handleApproveUpiFine(req, res, next) {
  const fineId = parseInt(req.params.id, 10);
  try {
    const fine = await fineService.approveUpiFine(fineId);

    await logActivity({
      userId: req.user.id,
      action: 'FINE_UPI_APPROVED',
      entity: 'Fine',
      entityId: fineId,
      details: `Approved UPI fine payment of ₹${fine.amount} (UTR: ${fine.utr_number}) for student ID ${fine.student_id}`
    });

    setFlash(req, 'success', `UPI Fine payment of ₹${Number(fine.amount).toFixed(2)} verified and settled! Receipt: ${fine.receipt_number}`);
    res.redirect(req.headers.referer || '/fines/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/fines/admin');
  }
}

async function handleRejectUpiFine(req, res, next) {
  const fineId = parseInt(req.params.id, 10);
  const { rejectionReason } = req.body;
  try {
    const fine = await fineService.rejectUpiFine(fineId, rejectionReason);

    await logActivity({
      userId: req.user.id,
      action: 'FINE_UPI_REJECTED',
      entity: 'Fine',
      entityId: fineId,
      details: `Rejected UPI fine payment for fine #${fineId}. Reason: ${rejectionReason}`
    });

    setFlash(req, 'warning', `Fine payment proof rejected and student notified.`);
    res.redirect(req.headers.referer || '/fines/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/fines/admin');
  }
}

async function handleWaiveFine(req, res, next) {
  const fineId = parseInt(req.params.id, 10);
  try {
    const fine = await fineService.waiveFine(fineId);

    await logActivity({
      userId: req.user.id,
      action: 'FINE_WAIVED',
      entity: 'Fine',
      entityId: fineId,
      details: `Waived fine of ₹${fine.amount} for student ID ${fine.student_id}`
    });

    setFlash(req, 'info', `Fine penalty of ₹${Number(fine.amount).toFixed(2)} waived.`);
    res.redirect(req.headers.referer || '/fines/admin');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(req.headers.referer || '/fines/admin');
  }
}

async function listStudentFines(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req, 10);

    const { fines, total, unpaidCount, verificationCount } = await fineService.getFines({
      studentId: req.student.id,
      skip,
      limit
    });

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    res.render('student/my-fines', {
      title: 'My Fines & Penalties | Library Management System',
      fines,
      pagination,
      unpaidCount,
      verificationCount
    });
  } catch (error) {
    next(error);
  }
}

async function submitStudentUpiFinePayment(req, res, next) {
  const fineId = parseInt(req.params.id, 10);
  const { utrNumber, paymentApp } = req.body;
  try {
    const screenshotUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;
    await fineService.submitStudentUpiFinePayment(fineId, req.student.id, {
      utrNumber,
      paymentApp,
      screenshotUrl
    });

    setFlash(req, 'success', 'UPI Payment proof submitted successfully! Verification is underway by the circulation desk.');
    res.redirect('/fines/student');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect('/fines/student');
  }
}

module.exports = {
  listAdminFines,
  handlePayFine,
  handleApproveUpiFine,
  handleRejectUpiFine,
  handleWaiveFine,
  listStudentFines,
  submitStudentUpiFinePayment
};
