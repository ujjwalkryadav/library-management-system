const { prisma } = require('../src/config/database');
const authService = require('../src/services/authService');
const { hasPermission } = require('../src/middleware/permissionAuth');
const { logActivity } = require('../src/services/activityLogger');
const bcrypt = require('bcryptjs');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

async function runEmployeeTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING EMPLOYEE & PERMISSION SYSTEM TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Admin Full Override Test
    console.log('1️⃣ Testing Admin Full Permissions Override:');
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    assert(hasPermission(adminUser, 'books.create') === true, 'Admin automatically has books.create');
    assert(hasPermission(adminUser, 'fines.waive') === true, 'Admin automatically has fines.waive');
    assert(hasPermission(adminUser, 'custom.any.permission') === true, 'Admin has wildcard full override');

    // 2. Employee Creation & Permission Check
    console.log('\n2️⃣ Testing Employee Account Creation & Granular Permissions:');
    const testEmpEmail = `test.employee.${Date.now()}@library.local`;
    const testEmpId = `EMP-TEST-${Date.now()}`;
    const hash = await bcrypt.hash('EmployeeSecret123!', 10);

    const empUser = await prisma.user.create({
      data: {
        name: 'Test Circulation Assistant',
        email: testEmpEmail,
        password_hash: hash,
        role: 'EMPLOYEE',
        phone: '+91 99999 11111',
        is_active: true,
        employee_profile: {
          create: {
            employee_id: testEmpId,
            department: 'Circulation',
            designation: 'Library Assistant',
            status: 'ACTIVE',
            permissions: {
              createMany: {
                data: [
                  { permission: 'dashboard.view' },
                  { permission: 'books.view' },
                  { permission: 'books.create' },
                  { permission: 'issues.view' },
                  { permission: 'issues.return' }
                ]
              }
            }
          }
        }
      },
      include: {
        employee_profile: {
          include: { permissions: true }
        }
      }
    });

    assert(empUser.role === 'EMPLOYEE', 'Employee user created with EMPLOYEE role');
    assert(empUser.employee_profile.permissions.length === 5, '5 permissions attached to employee profile');
    assert(hasPermission(empUser, 'books.create') === true, 'Employee has granted books.create permission');
    assert(hasPermission(empUser, 'issues.return') === true, 'Employee has granted issues.return permission');
    assert(hasPermission(empUser, 'books.delete') === false, 'Employee lacks books.delete permission (Properly Denied)');
    assert(hasPermission(empUser, 'fines.waive') === false, 'Employee lacks fines.waive permission (Properly Denied)');

    // 3. Permission Modification
    console.log('\n3️⃣ Testing Admin Dynamic Permission Updating:');
    // Admin grants 'fines.view' and revokes 'books.create'
    await prisma.employeePermission.deleteMany({
      where: { employee_id: empUser.employee_profile.id }
    });
    await prisma.employeePermission.createMany({
      data: [
        { employee_id: empUser.employee_profile.id, permission: 'dashboard.view' },
        { employee_id: empUser.employee_profile.id, permission: 'fines.view' }
      ]
    });

    const refreshedEmp = await prisma.user.findUnique({
      where: { id: empUser.id },
      include: {
        employee_profile: {
          include: { permissions: true }
        }
      }
    });

    assert(hasPermission(refreshedEmp, 'fines.view') === true, 'Granted fines.view is now active');
    assert(hasPermission(refreshedEmp, 'books.create') === false, 'Revoked books.create is now denied');

    // 4. Employee Activity Logging
    console.log('\n4️⃣ Testing Employee Activity Audit Trail Logging:');
    await logActivity({
      userId: empUser.id,
      action: 'BOOK_ISSUED',
      entity: 'IssuedBook',
      entityId: 999,
      details: 'Issued book to test student'
    });

    const loggedActivity = await prisma.employeeActivityLog.findFirst({
      where: { user_id: empUser.id, action: 'BOOK_ISSUED' }
    });
    assert(loggedActivity !== null, 'Activity successfully written to employee_activity_logs table');
    assert(loggedActivity.details.includes('Issued book'), 'Audit details correctly persisted');

    // 5. Account Deactivation
    console.log('\n5️⃣ Testing Employee Deactivation Enforcement:');
    await prisma.employeeProfile.update({
      where: { id: empUser.employee_profile.id },
      data: { status: 'INACTIVE' }
    });
    await prisma.user.update({
      where: { id: empUser.id },
      data: { is_active: false }
    });

    const deactivatedEmp = await prisma.user.findUnique({
      where: { id: empUser.id },
      include: {
        employee_profile: {
          include: { permissions: true }
        }
      }
    });

    assert(hasPermission(deactivatedEmp, 'fines.view') === false, 'Deactivated employee loses all access permissions');

    // Clean up test employee
    await prisma.user.delete({ where: { id: empUser.id } });

    // 6. Student Guard Check
    console.log('\n6️⃣ Testing Student Role Access Denial:');
    const studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
    assert(hasPermission(studentUser, 'books.create') === false, 'Student blocked from staff permissions');
    assert(hasPermission(studentUser, 'dashboard.view') === false, 'Student blocked from staff dashboard view');

    console.log('\n======================================================');
    console.log(`🏁 EMPLOYEE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('❌ Error in employee tests:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEmployeeTests();
