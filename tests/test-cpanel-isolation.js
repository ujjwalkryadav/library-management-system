const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function loginUser(email, password) {
  const params = new URLSearchParams({ email, password });
  const loginRes = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    redirect: 'manual'
  });

  const cookie = loginRes.headers.get('set-cookie') || '';
  return {
    get: async (path) => {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Cookie: cookie },
        redirect: 'manual'
      });
      const data = await res.text();
      return { status: res.status, data };
    }
  };
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 VERIFYING DEDICATED C-PANEL & REMOVAL OF PUBLIC NAV/FOOTER');
  console.log('======================================================\n');

  // 1. Guest Check
  const guestHomeRes = await fetch(`${BASE_URL}/`);
  const guestHomeData = await guestHomeRes.text();
  assert(guestHomeData.includes('navbar-brand'), 'Guest home should include public navbar');
  assert(guestHomeData.includes('footer-custom'), 'Guest home should include public footer');
  assert(!guestHomeData.includes('admin-sidebar'), 'Guest home should not have admin-sidebar');
  console.log('✅ PASS: Guest views have clean public navbar and footer');

  // 2. Student Views Check
  const student = await loginUser('student1@college.edu', 'Student123!');
  const studentUrls = [
    '/student/dashboard',
    '/books',
    '/memberships/student',
    '/issues/student/my-books',
    '/issues/student/history',
    '/requests/student',
    '/fines/student',
    '/student/id-card',
    '/student/attendance',
    '/student/profile',
    '/notifications'
  ];

  for (const url of studentUrls) {
    const res = await student.get(url);
    assert.strictEqual(res.status, 200, `Expected 200 for student ${url}, got ${res.status}`);
    assert(res.data.includes('admin-layout'), `Student ${url} MUST be inside admin-layout`);
    assert(res.data.includes('admin-sidebar'), `Student ${url} MUST have admin-sidebar`);
    assert(res.data.includes('admin-topbar'), `Student ${url} MUST have admin-topbar`);
    assert(!res.data.includes('class="navbar navbar-expand-lg navbar-dark bg-dark"'), `Student ${url} MUST NOT have public navbar`);
    assert(!res.data.includes('class="site-footer"'), `Student ${url} MUST NOT have public footer`);
    console.log(`✅ PASS: Student ${url} renders exclusively in Control Panel with dedicated sidebar`);
  }

  // 3. Admin Views Check
  const admin = await loginUser('admin@library.local', 'ChangeThisPassword123!');
  const adminUrls = [
    '/admin/dashboard',
    '/attendance/scanner',
    '/attendance/admin',
    '/books',
    '/books/admin/create',
    '/admin/students',
    '/requests/admin',
    '/issues/admin',
    '/fines/admin',
    '/admin/employees',
    '/admin/settings',
    '/admin/profile'
  ];

  for (const url of adminUrls) {
    const res = await admin.get(url);
    assert.strictEqual(res.status, 200, `Expected 200 for admin ${url}, got ${res.status}`);
    assert(res.data.includes('admin-layout'), `Admin ${url} MUST be inside admin-layout`);
    assert(res.data.includes('admin-sidebar'), `Admin ${url} MUST have admin-sidebar`);
    assert(res.data.includes('admin-topbar'), `Admin ${url} MUST have admin-topbar`);
    assert(!res.data.includes('class="navbar navbar-expand-lg navbar-dark bg-dark"'), `Admin ${url} MUST NOT have public navbar`);
    assert(!res.data.includes('class="site-footer"'), `Admin ${url} MUST NOT have public footer`);
    console.log(`✅ PASS: Admin ${url} renders exclusively in Control Panel with dedicated sidebar`);
  }

  // 4. Employee Views Check
  const employee = await loginUser('employee@library.local', 'Employee123!');
  const employeeUrls = [
    '/employee/dashboard',
    '/attendance/scanner',
    '/attendance/admin',
    '/books'
  ];

  for (const url of employeeUrls) {
    const res = await employee.get(url);
    assert.strictEqual(res.status, 200, `Expected 200 for employee ${url}, got ${res.status}`);
    assert(res.data.includes('admin-layout'), `Employee ${url} MUST be inside admin-layout`);
    assert(res.data.includes('admin-sidebar'), `Employee ${url} MUST have admin-sidebar`);
    assert(res.data.includes('admin-topbar'), `Employee ${url} MUST have admin-topbar`);
    assert(!res.data.includes('class="navbar navbar-expand-lg navbar-dark bg-dark"'), `Employee ${url} MUST NOT have public navbar`);
    assert(!res.data.includes('class="site-footer"'), `Employee ${url} MUST NOT have public footer`);
    console.log(`✅ PASS: Employee ${url} renders exclusively in Control Panel with dedicated sidebar`);
  }

  console.log('\n======================================================');
  console.log('🏁 ALL CONTROL PANEL ISOLATION TESTS PASSED (100%)!');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
