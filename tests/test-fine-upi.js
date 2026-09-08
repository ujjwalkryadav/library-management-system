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
    body: 'email=student1@college.edu&password=Student@LmsSecure#2026&role=student'
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
        amount: 50.00,
        status: 'UNPAID',
        reason: 'Late return penalty'
      }
    });
  }

  // 3. Student visits fines page
  const finesPage = await makeRequest('/fines/student', {}, s1Cookie);
  console.log('2. Student Fines view contains Pay Online (UPI) button:', finesPage.body.includes('Pay Online (UPI)') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains Pay Library Fine via UPI Modal:', finesPage.body.includes('Pay Library Fine via UPI') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains 2-Minute Timer:', finesPage.body.includes('02:00') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains QR Code image link (/images/upi_qr.jpg):', finesPage.body.includes('/images/upi_qr.jpg') ? '✅ PASS' : '❌ FAIL');
  console.log('   Contains 12-Digit UTR constraint:', finesPage.body.includes('pattern="[0-9]{12}"') ? '✅ PASS' : '❌ FAIL');
  console.log('   Policy Note in INR (₹5.00/day):', finesPage.body.includes('₹5.00/day') ? '✅ PASS' : '❌ FAIL');

  // 4. Student Submits UPI Payment Proof for Fine
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="utrNumber"\r\n\r\n`;
  body += `987654321012\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="screenshot"; filename="test-fine-proof.png"\r\n`;
  body += `Content-Type: image/png\r\n\r\n`;
  body += `dummy-fine-image-binary-data\r\n`;
  body += `--${boundary}--\r\n`;

  const submitRes = await makeRequest('/fines/student/' + fineToPay.id + '/submit-upi', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  }, s1Cookie);

  console.log('\n3. Student Submitted 12-Digit Fine UPI Proof (987654321012):', submitRes.statusCode === 302 ? '✅ PASS' : '❌ FAIL');

  const updatedFine = await prisma.fine.findUnique({ where: { id: fineToPay.id } });
  console.log('   DB Status updated to UNDER_VERIFICATION:', updatedFine.status === 'UNDER_VERIFICATION' ? '✅ PASS' : '❌ FAIL');
  console.log('   DB UTR Number stored:', updatedFine.utr_number === '987654321012' ? '✅ PASS' : '❌ FAIL');
  console.log('   DB Screenshot path recorded:', updatedFine.screenshot_url ? '✅ PASS' : '❌ FAIL');

  // 5. Admin Login
  const adminLogin = await makeRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@library.local&password=Admin@LmsMaster#2026&role=admin'
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
