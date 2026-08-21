const { prisma } = require('../src/config/database');
const authService = require('../src/services/authService');
const bookService = require('../src/services/bookService');
const issueService = require('../src/services/issueService');
const fineService = require('../src/services/fineService');
const notificationService = require('../src/services/notificationService');
const { getSystemSettings } = require('../src/config/settings');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END SYSTEM INTEGRATION TESTS');
  console.log('======================================================\n');

  try {
    // 1. Settings test
    console.log('1️⃣ Testing System Settings & Configuration Engine:');
    const settings = await getSystemSettings(true);
    assert(settings.library_name.length > 0, 'Settings loaded with institutional title');
    assert(typeof settings.loan_period_days === 'number', 'Loan period days is a valid number');
    assert(typeof settings.fine_per_day === 'number', 'Fine per day is a valid number');

    // 2. Auth tests
    console.log('\n2️⃣ Testing Authentication, Hashing & Student Registration:');
    const testStudentId = 'STU-TEST-' + Date.now();
    const testEmail = `test.student.${Date.now()}@college.edu`;

    const registeredStudent = await authService.registerStudent({
      name: 'Integration Test Student',
      email: testEmail,
      password: 'SecurePassword123!',
      phone: '+91 98765 00000',
      studentId: testStudentId,
      department: 'Computer Science',
      course: 'B.Tech CSE'
    });
    assert(registeredStudent.id && registeredStudent.student_profile.student_id === testStudentId, 'Student registration created User and StudentProfile atomically');

    // Duplicate email check
    try {
      await authService.registerStudent({
        name: 'Duplicate Student',
        email: testEmail,
        password: 'Password123!',
        studentId: testStudentId + '-2',
        department: 'CS',
        course: 'B.Tech'
      });
      assert(false, 'Should have blocked duplicate email registration');
    } catch (e) {
      assert(true, 'Correctly rejected duplicate email registration');
    }

    // Login verification
    const verifiedUser = await authService.verifyLogin(testEmail, 'SecurePassword123!');
    assert(verifiedUser.email === testEmail, 'Verified login with correct credentials');

    try {
      await authService.verifyLogin(testEmail, 'WrongPassword!');
      assert(false, 'Should have rejected wrong password');
    } catch (e) {
      assert(true, 'Correctly rejected invalid password');
    }

    // 3. Book Catalog & Filtering
    console.log('\n3️⃣ Testing Book Catalog Queries & Multi-Filtering:');
    const catalog = await bookService.getBooks({ limit: 10 });
    assert(catalog.books.length > 0, `Retrieved ${catalog.books.length} books from catalog`);

    const searchResult = await bookService.getBooks({ search: 'Atomic Habits' });
    assert(searchResult.books.some(b => b.title.includes('Atomic Habits')), 'Live search successfully matched title');

    // 4. Book Issue Request & Atomic Approval Workflow
    console.log('\n4️⃣ Testing Student Book Request & Admin Transactional Approval:');
    const bookToTest = catalog.books.find(b => b.available_copies > 0);
    assert(bookToTest !== undefined, 'Found book with available copies for testing');

    const initialAvailableCopies = bookToTest.available_copies;
    const studentProfileId = registeredStudent.student_profile.id;

    // Submit Request
    const request = await issueService.requestBook(studentProfileId, bookToTest.id);
    assert(request.status === 'PENDING', 'Book issue request successfully created with status PENDING');

    // Check duplicate request prevention
    try {
      await issueService.requestBook(studentProfileId, bookToTest.id);
      assert(false, 'Should have prevented duplicate pending request for same book');
    } catch (e) {
      assert(true, 'Correctly prevented duplicate pending request for same book');
    }

    // Admin approves request in atomic transaction
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const approvalResult = await issueService.approveRequest(request.id, adminUser.id);
    assert(approvalResult.request.status === 'APPROVED', 'Request status updated to APPROVED');
    assert(approvalResult.issue.status === 'ISSUED', 'IssuedBook record created with status ISSUED');

    // Verify available copies decreased by exactly 1
    const bookAfterApproval = await bookService.getBookById(bookToTest.id);
    assert(bookAfterApproval.available_copies === initialAvailableCopies - 1, `Available copies decremented from ${initialAvailableCopies} to ${bookAfterApproval.available_copies}`);

    // 5. Renewal Workflow
    console.log('\n5️⃣ Testing Book Loan Renewal:');
    const renewedIssue = await issueService.renewBook(approvalResult.issue.id, studentProfileId);
    assert(renewedIssue.renewal_count === 1, 'Renewal count incremented to 1');
    assert(new Date(renewedIssue.due_date) > new Date(approvalResult.issue.due_date), 'Due date extended into future');

    // 6. Book Return & Fine Calculation Workflow
    console.log('\n6️⃣ Testing Book Return & Overdue Fine Assessment:');
    // Simulate return
    const returnResult = await issueService.processReturn(approvalResult.issue.id);
    assert(returnResult.issue.status === 'RETURNED', 'Issue status marked as RETURNED');

    // Verify available copies restored
    const bookAfterReturn = await bookService.getBookById(bookToTest.id);
    assert(bookAfterReturn.available_copies === initialAvailableCopies, `Available copies restored back to ${bookAfterReturn.available_copies}`);

    // Prevent double return
    try {
      await issueService.processReturn(approvalResult.issue.id);
      assert(false, 'Should have failed safe return on already returned issue');
    } catch (e) {
      assert(true, 'Safely blocked double return of already returned book');
    }

    // Test overdue fine calculation logic
    console.log('\n7️⃣ Testing Overdue Fine Assessment & Settlement:');
    // Create an artificially overdue issue record (10 days past due)
    const overdueDueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const overdueIssue = await prisma.issuedBook.create({
      data: {
        student_id: studentProfileId,
        book_id: bookToTest.id,
        issued_by: adminUser.id,
        issue_date: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
        due_date: overdueDueDate,
        status: 'OVERDUE'
      }
    });

    const overdueReturnResult = await issueService.processReturn(overdueIssue.id);
    assert(overdueReturnResult.overdueDays >= 9, `Calculated overdue days (${overdueReturnResult.overdueDays} days)`);
    assert(overdueReturnResult.fine !== null, 'Fine record generated for late return');
    const expectedFine = overdueReturnResult.overdueDays * settings.fine_per_day;
    assert(Math.abs(parseFloat(overdueReturnResult.fine.amount) - expectedFine) < 0.01, `Fine amount ($${overdueReturnResult.fine.amount}) matched overdue days * fine_per_day ($${expectedFine})`);

    // Settle fine as PAID
    const paidFine = await fineService.markFinePaid(overdueReturnResult.fine.id);
    assert(paidFine.status === 'PAID' && paidFine.paid_at !== null, 'Fine successfully settled as PAID');

    // 8. Notifications
    console.log('\n8️⃣ Testing Notifications System:');
    const notifications = await notificationService.getUserNotifications(registeredStudent.id);
    assert(notifications.length > 0, `Student received ${notifications.length} automatic system notifications`);
    await notificationService.markAllAsRead(registeredStudent.id);
    const unreadCount = await prisma.notification.count({ where: { user_id: registeredStudent.id, is_read: false } });
    assert(unreadCount === 0, 'All notifications marked as read');

    // 9. Safety & Invariant Tests
    console.log('\n9️⃣ Testing Safety Constraints & Deletion Integrity:');
    // Cannot delete book with active loans
    const newActiveIssue = await prisma.issuedBook.create({
      data: {
        student_id: studentProfileId,
        book_id: bookToTest.id,
        issued_by: adminUser.id,
        issue_date: new Date(),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'ISSUED'
      }
    });

    try {
      await bookService.deleteOrArchiveBook(bookToTest.id);
      assert(false, 'Should have blocked deletion of book with active loan');
    } catch (e) {
      assert(true, 'Safely blocked deletion of actively loaned book');
    }

    // Clean up test active issue
    await prisma.issuedBook.delete({ where: { id: newActiveIssue.id } });

    console.log('\n======================================================');
    console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('======================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test suite fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
