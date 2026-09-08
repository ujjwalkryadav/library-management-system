const http = require('http');

async function makeRequest(path, options = {}, cookie = '') {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(
      `http://localhost:3000${path}`,
      {
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : cookie
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function verifyAllRoutes() {
  console.log('\n======================================================');
  console.log('🌐 TESTING ALL HTTP ROUTES, TEMPLATES, AND EMPLOYEE ROLES');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function check(condition, desc) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Public Routes
    console.log('1️⃣ Testing Public & Authentication Pages:');
    const home = await makeRequest('/');
    check(home.statusCode === 200 && home.body.includes('Discover Knowledge'), 'GET / renders prestigious Homepage (Reference Image 1)');

    const catalog = await makeRequest('/books');
    check(catalog.statusCode === 200 && catalog.body.includes('Catalog'), 'GET /books renders public catalog');

    const loginPage = await makeRequest('/login');
    check(loginPage.statusCode === 200 && loginPage.body.includes('Login to Your Account'), 'GET /login renders split login form (Reference Image 2)');

    const registerPage = await makeRequest('/register');
    check(registerPage.statusCode === 200 && registerPage.body.includes('Student Registration'), 'GET /register renders registration form');

    // 2. Admin Authentication & Dashboard
    console.log('\n2️⃣ Testing Admin Login & Protected Admin Views:');
    const adminLoginRes = await makeRequest('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=admin@library.local&password=Admin@LmsMaster#2026'
    });
    check(adminLoginRes.statusCode === 302 && adminLoginRes.headers.location === '/admin/dashboard', 'POST /login authenticates Admin and redirects to /admin/dashboard');

    const adminCookie = adminLoginRes.cookie;

    const adminDash = await makeRequest('/admin/dashboard', {}, adminCookie);
    check(adminDash.statusCode === 200 && adminDash.body.includes('Books Issued Overview'), 'GET /admin/dashboard renders Reference Image 3 layout');

    const adminEmployees = await makeRequest('/admin/employees', {}, adminCookie);
    check(adminEmployees.statusCode === 200 && adminEmployees.body.includes('Staff Members Directory'), 'GET /admin/employees renders staff directory');

    const adminCreateEmp = await makeRequest('/admin/employees/create', {}, adminCookie);
    check(adminCreateEmp.statusCode === 200 && adminCreateEmp.body.includes('Assign Operational Permissions'), 'GET /admin/employees/create renders permissions matrix');

    const adminEmpLogs = await makeRequest('/admin/employees/logs', {}, adminCookie);
    check(adminEmpLogs.statusCode === 200 && adminEmpLogs.body.includes('Activity Audit Trail'), 'GET /admin/employees/logs renders audit logs');

    const adminRequests = await makeRequest('/requests/admin', {}, adminCookie);
    check(adminRequests.statusCode === 200 && adminRequests.body.includes('Book Issue Requests'), 'GET /requests/admin renders request queue');

    const adminIssues = await makeRequest('/issues/admin', {}, adminCookie);
    check(adminIssues.statusCode === 200 && adminIssues.body.includes('Book Circulation & Issued Books'), 'GET /issues/admin renders active issued books table');

    const adminMemberships = await makeRequest('/memberships/admin', {}, adminCookie);
    check(adminMemberships.statusCode === 200 && adminMemberships.body.includes('Student Monthly Membership Registry'), 'GET /memberships/admin renders membership fee ledger');

    const adminFines = await makeRequest('/fines/admin', {}, adminCookie);
    check(adminFines.statusCode === 200 && adminFines.body.includes('Fine Ledger & Penalties'), 'GET /fines/admin renders fines ledger');

    const adminStudents = await makeRequest('/admin/students', {}, adminCookie);
    check(adminStudents.statusCode === 200 && adminStudents.body.includes('Student Directory'), 'GET /admin/students renders student directory');

    const adminSettings = await makeRequest('/admin/settings', {}, adminCookie);
    check(adminSettings.statusCode === 200 && adminSettings.body.includes('Library System Policies'), 'GET /admin/settings renders policy engine');

    // 3. Employee Authentication & Staff Portal
    console.log('\n3️⃣ Testing Employee Login & Staff Operations Portal:');
    const empLoginRes = await makeRequest('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=employee@library.local&password=Staff@LmsVault#2026'
    });
    check(empLoginRes.statusCode === 302 && empLoginRes.headers.location === '/employee/dashboard', 'POST /login authenticates Employee and redirects to /employee/dashboard');

    const empCookie = empLoginRes.cookie;

    const empDash = await makeRequest('/employee/dashboard', {}, empCookie);
    check(empDash.statusCode === 200 && empDash.body.includes('Staff Operations Portal'), 'GET /employee/dashboard renders dedicated staff portal');

    // Employee cannot access Admin-only settings
    const empAccessingSettings = await makeRequest('/admin/settings', {}, empCookie);
    check(empAccessingSettings.statusCode === 403, 'Employee blocked from /admin/settings with HTTP 403 Forbidden');

    // Employee cannot access Admin-only employee management
    const empAccessingEmployees = await makeRequest('/admin/employees', {}, empCookie);
    check(empAccessingEmployees.statusCode === 403, 'Employee blocked from /admin/employees with HTTP 403 Forbidden');

    // 4. Student Authentication & Portal
    console.log('\n4️⃣ Testing Student Login & Protected Student Views:');
    const studentLoginRes = await makeRequest('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=student1@college.edu&password=Student@LmsSecure#2026'
    });
    check(studentLoginRes.statusCode === 302 && studentLoginRes.headers.location === '/student/dashboard', 'POST /login authenticates Student and redirects to /student/dashboard');

    const studentCookie = studentLoginRes.cookie;

    const studentDash = await makeRequest('/student/dashboard', {}, studentCookie);
    check(studentDash.statusCode === 200 && studentDash.body.includes('Welcome back'), 'GET /student/dashboard renders student welcome banner');

    const studentMembership = await makeRequest('/memberships/student', {}, studentCookie);
    check(studentMembership.statusCode === 200 && studentMembership.body.includes('My Library Membership & Fee Status'), 'GET /memberships/student renders student membership & fees');

    const studentLoans = await makeRequest('/issues/student/my-books', {}, studentCookie);
    check(studentLoans.statusCode === 200 && studentLoans.body.includes('My Borrowed Books'), 'GET /issues/student/my-books renders student borrowed books');

    const studentRequests = await makeRequest('/requests/student', {}, studentCookie);
    check(studentRequests.statusCode === 200 && studentRequests.body.includes('My Book'), 'GET /requests/student renders student requests');

    const studentFines = await makeRequest('/fines/student', {}, studentCookie);
    check(studentFines.statusCode === 200 && studentFines.body.includes('My Library Fines & Dues'), 'GET /fines/student renders student fine ledger');

    // Student blocked from Admin and Staff portals
    const studentAccessingAdmin = await makeRequest('/admin/dashboard', {}, studentCookie);
    check(studentAccessingAdmin.statusCode === 403, 'Student blocked from /admin/dashboard with HTTP 403 Forbidden');

    const studentAccessingEmployee = await makeRequest('/employee/dashboard', {}, studentCookie);
    check(studentAccessingEmployee.statusCode === 403, 'Student blocked from /employee/dashboard with HTTP 403 Forbidden');

    console.log('\n======================================================');
    console.log(`🏁 ROUTE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('HTTP route test error:', err);
    process.exit(1);
  }
}

verifyAllRoutes();
