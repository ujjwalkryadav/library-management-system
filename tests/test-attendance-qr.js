const http = require('http');
const { prisma } = require('../src/config/database');
const attendanceService = require('../src/services/attendanceService');
const authService = require('../src/services/authService');

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
  console.log('🧪 RUNNING QR STUDENT ID & ATTENDANCE TRACKING INTEGRATION TESTS');
  console.log('======================================================\n');

  try {
    // Clean attendance table before test run
    await prisma.studentAttendance.deleteMany();

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const studentProfile1 = await prisma.studentProfile.findFirst({
      where: { student_id: 'CS2024001' },
      include: { user: true }
    });
    const studentProfile2 = await prisma.studentProfile.findFirst({
      where: { student_id: 'IT2024003' },
      include: { user: true }
    });

    assert(studentProfile1 && studentProfile2, 'Found test students (Rahul & Priya) in database');

    // 1. Test QR Token Presence
    console.log('\n1️⃣ Testing QR Token & Digital Card Identifier:');
    assert(studentProfile1.qr_code_token !== null, `Student 1 has QR Code Token: ${studentProfile1.qr_code_token}`);

    // 2. Test 1st Scan Check-In
    console.log('\n2️⃣ Testing First QR Scan (Automated Check-In):');
    const scan1 = await attendanceService.recordScanAttendance({
      studentIdentifier: studentProfile1.qr_code_token,
      staffId: adminUser.id,
      scanMode: 'QR_SCAN',
      notes: 'Main Gate Camera Scanner'
    });

    assert(scan1.action === 'CHECK_IN', 'Scan result action is CHECK_IN');
    assert(scan1.attendance.status === 'PRESENT', 'Attendance status marked as PRESENT');
    assert(scan1.attendance.check_in !== null, 'Check-in timestamp recorded');
    assert(scan1.attendance.check_out === null, 'Check-out is null during initial check-in');
    assert(scan1.student.name === 'Rahul Sharma', 'Student details enriched with full name');
    assert(scan1.student.active_issues_count >= 0, 'Active book loans count retrieved');

    // 3. Test 2nd Scan Check-Out
    console.log('\n3️⃣ Testing Second QR Scan (Automated Check-Out Toggle):');
    const scan2 = await attendanceService.recordScanAttendance({
      studentIdentifier: studentProfile1.student_id, // Testing with student_id fallback
      staffId: adminUser.id,
      scanMode: 'QR_SCAN'
    });

    assert(scan2.action === 'CHECK_OUT', 'Second scan toggled action to CHECK_OUT');
    assert(scan2.attendance.check_out !== null, 'Check-out timestamp recorded on 2nd scan');

    // 4. Test 3rd Scan (Already Completed Today)
    console.log('\n4️⃣ Testing Third QR Scan (Already Completed Notice):');
    const scan3 = await attendanceService.recordScanAttendance({
      studentIdentifier: studentProfile1.qr_code_token,
      staffId: adminUser.id
    });
    assert(scan3.action === 'ALREADY_COMPLETED', 'Third scan correctly identified ALREADY_COMPLETED');

    // 5. Test Scan for Student 2
    console.log('\n5️⃣ Testing Scan for Student 2 (Priya):');
    const scanStudent2 = await attendanceService.recordScanAttendance({
      studentIdentifier: studentProfile2.qr_code_token,
      staffId: adminUser.id,
      scanMode: 'QR_SCAN'
    });
    assert(scanStudent2.action === 'CHECK_IN', 'Student 2 Check-in recorded');

    // 6. Test Daily Attendance Ledger & Stats
    console.log('\n6️⃣ Testing Attendance Ledger & KPI Aggregations:');
    const ledger = await attendanceService.getAttendanceLogs({});

    assert(ledger.total >= 2, `Retrieved ${ledger.total} attendance records for today`);
    assert(ledger.stats.todayPresentCount >= 2, `Present count calculated (${ledger.stats.todayPresentCount})`);
    assert(ledger.stats.todayCheckedOutCount >= 1, `Checked-out count calculated (${ledger.stats.todayCheckedOutCount})`);
    assert(ledger.stats.attendanceRate > 0, `Attendance rate calculated (${ledger.stats.attendanceRate}%)`);

    // 7. Test Manual Attendance Entry by Staff / Teacher
    console.log('\n7️⃣ Testing Manual Attendance Entry & Overrides:');
    const studentProfile3 = await prisma.studentProfile.findFirst({
      where: { student_id: 'ME2024007' }
    });

    const manualRecord = await attendanceService.markManualAttendance({
      studentId: studentProfile3.id,
      date: new Date(),
      checkInTime: '10:30',
      checkOutTime: '14:45',
      status: 'LATE',
      staffId: adminUser.id,
      notes: 'Manual teacher override for workshop session'
    });

    assert(manualRecord.status === 'LATE', 'Manual attendance created with custom status LATE');
    assert(manualRecord.scan_mode === 'MANUAL', 'Scan mode recorded as MANUAL');

    // 8. Test Attendance Update & Edit
    console.log('\n8️⃣ Testing Attendance Edit & Status Adjustment:');
    const updatedRecord = await attendanceService.updateAttendance(manualRecord.id, {
      status: 'PRESENT',
      notes: 'Late excused by professor'
    });
    assert(updatedRecord.status === 'PRESENT', 'Attendance status updated to PRESENT');
    assert(updatedRecord.notes === 'Late excused by professor', 'Attendance notes updated');

    // 9. Test Student Personal Attendance Summary
    console.log('\n9️⃣ Testing Student Personal Attendance Summary:');
    const studentSummary = await attendanceService.getStudentAttendanceSummary(studentProfile1.id);
    assert(studentSummary.attendances.length >= 1, `Student 1 retrieved ${studentSummary.attendances.length} personal visit logs`);
    assert(studentSummary.totalPresentCount >= 1, 'Total present count calculated for student');

    // 10. Test Delete Record
    console.log('\n🔟 Testing Delete Attendance Record:');
    const deleted = await attendanceService.deleteAttendance(manualRecord.id, adminUser.id);
    assert(deleted.id === manualRecord.id, 'Attendance record deleted cleanly');

    console.log('\n======================================================');
    console.log(`🏁 ATTENDANCE TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('======================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Attendance test suite error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
