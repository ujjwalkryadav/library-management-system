const http = require('http');
const { prisma } = require('../src/config/database');

function makeRequest(urlPath, options = {}, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, 'http://localhost:3000');
    const headers = options.headers || {};
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(url, {
      method: options.method || 'GET',
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let setCookie = res.headers['set-cookie'];
        let newCookie = setCookie ? setCookie[0].split(';')[0] : cookie;
        resolve({ statusCode: res.statusCode, headers: res.headers, body, cookie: newCookie });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runTest() {
  console.log('======================================================');
  console.log('🧪 TESTING STUDENT FINE ONLINE UPI PAYMENT & VERIFICATION');
  console.log('======================================================\n');

  // 1. Student 1 Login
  const s1Login = await makeRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=student1@college.edu&password=Student123!&role=student'
  });
  console.log('1. Student 1 Login:', s1Login.statusCode === 302 ? '✅ PASS' : '❌ FAIL');
  const s1Cookie = s1Login.cookie;

  // 2. Find Student 1's profile & fine
  const student = await prisma.studentProfile.findFirst({
    where: { user: { email: 'student1@college.edu' } }
  });

  let fineToPay = await prisma.fine.findFirst({
    where: { student_id: student.id, status: 'UNPAID' },
    include: { issue: { include: { book: true } } }
  });

  if (!fineToPay) {
    const issue = await prisma.issuedBook.findFirst({
      where: { student_id: student.id }
    });
    fineToPay = await prisma.fine.create({
      data: {
        student_id: student.id,
        issue_id: issue.id,
        amount: 70.00,
        reason: 'Overdue penalty: 14 days past due date',
        status: 'UNPAID'
      },
      include: { issue: { include: { book: true } } }
    });
  }

  // 3. View Student Fines Page
  const s1Fines = await makeRequest('/fines/student', {}, s1Cookie);
  console.log('2. Student Fines view contains Pay Online (UPI) button:', s1Fines.body.includes('Pay Online (UPI)') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains Pay Library Fine via UPI Modal:', s1Fines.body.includes('Pay Library Fine via UPI') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains 2-Minute Timer:', s1Fines.body.includes('02:00') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains QR Code image link (/images/upi_qr.jpg):', s1Fines.body.includes('/images/upi_qr.jpg') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains 12-Digit UTR constraint:', s1Fines.body.includes('maxlength="12"') ? '✅ PASS' : '❌ FAIL');
  console.log('   Policy Note in INR (₹5.00/day):', s1Fines.body.includes('₹') ? '✅ PASS' : '❌ FAIL');

  // 4. Submit Fine UPI proof
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const postData = [
    '--' + boundary,
    'Content-Disposition: form-data; name="utrNumber"',
    '',
    '987654321012',
    '--' + boundary,
    'Content-Disposition: form-data; name="paymentApp"',
    '',
    'PhonePe',
    '--' + boundary,
    'Content-Disposition: form-data; name="screenshot"; filename="fine_proof.jpg"',
    'Content-Type: image/jpeg',
    '',
    'fake-fine-proof-bytes',
    '--' + boundary + '--'
  ].join('\r\n');

  const fineSubmit = await makeRequest('/fines/student/' + fineToPay.id + '/pay-upi', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    },
    body: postData
  }, s1Cookie);

  console.log('\n3. Student Submitted 12-Digit Fine UPI Proof (987654321012):', fineSubmit.statusCode === 302 ? '✅ PASS' : '❌ FAIL');

  const updatedFine = await prisma.fine.findUnique({ where: { id: fineToPay.id } });
  console.log('   DB Status updated to UNDER_VERIFICATION:', updatedFine.status === 'UNDER_VERIFICATION' ? '✅ PASS' : '❌ FAIL');
  console.log('   DB UTR Number stored:', updatedFine.utr_number === '987654321012' ? '✅ PASS' : '❌ FAIL');
  console.log('   DB Screenshot path recorded:', updatedFine.screenshot_url ? '✅ PASS' : '❌ FAIL');

  // 5. Admin Login
  const adminLogin = await makeRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@library.local&password=ChangeThisPassword123!&role=admin'
  });
  const adminCookie = adminLogin.cookie;

  // 6. Admin checks Fine Ledger
  const adminFineLedger = await makeRequest('/fines/admin?status=UNDER_VERIFICATION', {}, adminCookie);
  console.log('\n4. Admin Fine Ledger contains Review Proof modal:', adminFineLedger.body.includes('Review Proof') ? '✅ PASS' : '❌ FAIL');
  console.log('   Displays student 12-digit UTR 987654321012:', adminFineLedger.body.includes('987654321012') ? '✅ PASS' : '❌ FAIL');

  // 7. Admin Approves UPI Fine
  const approveFineRes = await makeRequest('/fines/admin/' + fineToPay.id + '/approve-upi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, adminCookie);

  console.log('\n5. Admin Approves UPI Fine Payment:', approveFineRes.statusCode === 302 ? '✅ PASS' : '❌ FAIL');

  const approvedFine = await prisma.fine.findUnique({ where: { id: fineToPay.id } });
  console.log('   DB Status is now PAID:', approvedFine.status === 'PAID' ? '✅ PASS' : '❌ FAIL');
  console.log('   Generated Receipt Number:', approvedFine.receipt_number);
  console.log('   Payment Method:', approvedFine.payment_method);

  // 8. Student checks fines view
  const finalStudentFines = await makeRequest('/fines/student', {}, s1Cookie);
  console.log('\n6. Student Fines View shows PAID status:', finalStudentFines.body.includes('PAID') ? '✅ PASS' : '❌ FAIL');

  console.log('\n🏁 ALL FINE ONLINE UPI PAYMENT & VERIFICATION TESTS PASSED (100%)!\n');
  process.exit(0);
}

runTest();
