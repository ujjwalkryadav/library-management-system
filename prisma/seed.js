const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Library Management System database seeding with ONLY user-specified 7 books...');

  // 1. Clean existing records in reverse dependency order
  await prisma.studentAttendance.deleteMany();
  await prisma.studentMembership.deleteMany();
  await prisma.employeeActivityLog.deleteMany();
  await prisma.employeePermission.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fine.deleteMany();
  await prisma.issuedBook.deleteMany();
  await prisma.bookIssueRequest.deleteMany();
  await prisma.book.deleteMany();
  await prisma.category.deleteMany();
  await prisma.author.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSetting.deleteMany();

  console.log('✓ Cleared old data.');

  // 2. Seed System Settings
  const settingsData = [
    { key: 'library_name', value: 'Library Management System', description: 'Institutional library title displayed across portals' },
    { key: 'max_books_per_student', value: '3', description: 'Maximum concurrent books a student can hold' },
    { key: 'loan_period_days', value: '14', description: 'Standard loan duration in days before overdue' },
    { key: 'fine_per_day', value: '5.00', description: 'Default penalty fee per overdue day (currency units)' },
    { key: 'renewal_limit', value: '2', description: 'Maximum times a book loan can be renewed' },
    { key: 'allow_student_registration', value: 'true', description: 'Whether public student self-registration is enabled' }
  ];

  for (const s of settingsData) {
    await prisma.systemSetting.create({ data: s });
  }
  console.log('✓ Seeded system settings.');

  // 3. Seed Admin User
  const adminPasswordHash = await bcrypt.hash('Admin@LmsMaster#2026', 10);
  const adminUser = await prisma.user.create({
    data: {
      name: 'Chief Librarian Admin',
      email: 'admin@library.local',
      password_hash: adminPasswordHash,
      role: 'ADMIN',
      phone: '+91 98765 43210',
      is_active: true
    }
  });
  console.log('✓ Seeded Admin User (admin@library.local / Admin@LmsMaster#2026)');

  // 4. Seed Employee User (Staff)
  const employeePasswordHash = await bcrypt.hash('Staff@LmsVault#2026', 10);
  const employeeUser = await prisma.user.create({
    data: {
      name: 'Pooja Sharma',
      email: 'employee@library.local',
      password_hash: employeePasswordHash,
      role: 'EMPLOYEE',
      phone: '+91 98765 11223',
      is_active: true,
      employee_profile: {
        create: {
          employee_id: 'EMP2026001',
          department: 'Circulation & Cataloging',
          designation: 'Assistant Librarian',
          phone: '+91 98765 11223',
          status: 'ACTIVE',
          permissions: {
            createMany: {
              data: [
                { permission: 'dashboard.view' },
                { permission: 'books.view' },
                { permission: 'books.create' },
                { permission: 'books.edit' },
                { permission: 'requests.view' },
                { permission: 'requests.approve' },
                { permission: 'requests.reject' },
                { permission: 'issues.view' },
                { permission: 'issues.create' },
                { permission: 'issues.return' },
                { permission: 'attendance.view' },
                { permission: 'attendance.scan' },
                { permission: 'attendance.manage' },
                { permission: 'notifications.view' }
              ]
            }
          }
        }
      }
    },
    include: { employee_profile: true }
  });
  console.log('✓ Seeded Employee User (employee@library.local / Staff@LmsVault#2026)');

  // 5. Seed Categories matching the 7 books
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Psychology & Behavior', description: 'Cognitive Psychology, Habits, and Behavioral Science' } }),
    prisma.category.create({ data: { name: 'Business & Wealth', description: 'Personal Finance, Wealth Mindset, and Economics' } }),
    prisma.category.create({ data: { name: 'Self-Development', description: 'Routines, Morning Mastery, and Peak Performance' } }),
    prisma.category.create({ data: { name: 'Philosophy & Mindfulness', description: 'Eastern Philosophy, Purpose of Life, and Ikigai' } })
  ]);
  console.log(`✓ Seeded ${categories.length} categories.`);

  // 6. Seed Authors matching the 7 books
  const authors = await Promise.all([
    prisma.author.create({ data: { name: 'James Clear', biography: 'Author of the #1 global bestseller Atomic Habits.' } }),
    prisma.author.create({ data: { name: 'Morgan Housel', biography: 'Partner at Collaborative Fund and author of The Psychology of Money.' } }),
    prisma.author.create({ data: { name: 'Dr. Joseph Murphy', biography: 'Author of the acclaimed classic The Power of Your Subconscious Mind.' } }),
    prisma.author.create({ data: { name: 'Robin Sharma', biography: 'Globally respected leadership mentor and author of The 5 AM Club.' } }),
    prisma.author.create({ data: { name: 'Héctor García & Francesc Miralles', biography: 'Authors of the international sensation Ikigai.' } }),
    prisma.author.create({ data: { name: 'Ankur Warikoo', biography: 'Entrepreneur, mentor, and bestselling author of Do Epic Shit.' } }),
    prisma.author.create({ data: { name: 'Thomas Erikson', biography: 'Behavioral expert, lecturer, and author of Surrounded by Idiots.' } })
  ]);
  console.log(`✓ Seeded ${authors.length} authors.`);

  // 7. Seed ONLY the 7 Books corresponding to the Books folder cover images
  const booksData = [
    {
      title: 'Atomic Habits',
      isbn: '9781847941831',
      description: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones. James Clear reveals practical strategies to form good habits and achieve remarkable results.',
      author_id: authors[0].id,
      category_id: categories[0].id,
      publisher: 'Random House Business',
      publication_year: 2018,
      language: 'English',
      total_copies: 6,
      available_copies: 5,
      shelf_location: 'PSY-A1-02',
      cover_image: '/images/books/cover_9781847941831.webp'
    },
    {
      title: 'The Psychology of Money',
      isbn: '9789355431356',
      description: 'Timeless Lessons on Wealth, Greed, and Happiness. Morgan Housel explores how human behavior shapes financial success far more than spreadsheets.',
      author_id: authors[1].id,
      category_id: categories[1].id,
      publisher: 'Harriman House',
      publication_year: 2020,
      language: 'English',
      total_copies: 5,
      available_copies: 4,
      shelf_location: 'BUS-B2-05',
      cover_image: '/images/books/cover_9789355431356.webp'
    },
    {
      title: 'The Power of Your Subconscious Mind',
      isbn: '9789380480015',
      description: 'Dr. Joseph Murphy explains how the subconscious mind influences everything you do and how mental visualization can unlock prosperity and health.',
      author_id: authors[2].id,
      category_id: categories[0].id,
      publisher: 'Fingerprint! Publishing',
      publication_year: 2015,
      language: 'English',
      total_copies: 4,
      available_copies: 4,
      shelf_location: 'PSY-C1-09',
      cover_image: '/images/books/cover_9789380480015.webp'
    },
    {
      title: 'The 5 AM Club',
      isbn: '9780143469155',
      description: 'Own Your Morning. Elevate Your Life. Robin Sharma reveals a transformative morning routine that helps maximize productivity and personal genius.',
      author_id: authors[3].id,
      category_id: categories[2].id,
      publisher: 'HarperCollins',
      publication_year: 2018,
      language: 'English',
      total_copies: 5,
      available_copies: 4,
      shelf_location: 'SLF-D3-11',
      cover_image: '/images/books/cover_9780143469155.jpg'
    },
    {
      title: 'Ikigai: The Japanese Secret to a Long and Happy Life',
      isbn: '9798897778263',
      description: 'Unlock the longevity secrets of Okinawa. Discover your ikigai to bring purpose, vitality, and fulfillment to every day.',
      author_id: authors[4].id,
      category_id: categories[3].id,
      publisher: 'Penguin Life',
      publication_year: 2017,
      language: 'English',
      total_copies: 6,
      available_copies: 5,
      shelf_location: 'PHI-E1-04',
      cover_image: '/images/books/cover_9798897778263.jpg'
    },
    {
      title: 'Do Epic Shit',
      isbn: '9780143452126',
      description: 'Ankur Warikoo shares key reflections on success, failure, habits, money, and awareness to help you craft your own life journey.',
      author_id: authors[5].id,
      category_id: categories[2].id,
      publisher: 'Juggernaut Books',
      publication_year: 2021,
      language: 'English',
      total_copies: 4,
      available_copies: 4,
      shelf_location: 'SLF-A2-07',
      cover_image: '/images/books/cover_9780143452126.webp'
    },
    {
      title: 'Surrounded by Idiots',
      isbn: '9780241539590',
      description: 'The Four Types of Human Behavior. Thomas Erikson explains how to understand personality dynamics and communicate with anyone effectively.',
      author_id: authors[6].id,
      category_id: categories[0].id,
      publisher: 'St. Martin’s Essentials',
      publication_year: 2019,
      language: 'English',
      total_copies: 5,
      available_copies: 4,
      shelf_location: 'PSY-B3-15',
      cover_image: '/images/books/cover_9780241539590.webp'
    }
  ];

  const createdBooks = [];
  for (const b of booksData) {
    const bk = await prisma.book.create({ data: b });
    createdBooks.push(bk);
  }
  console.log(`✓ Seeded ${createdBooks.length} books strictly matching the Books folder images.`);

  // 8. Seed Students
  const studentPasswordHash = await bcrypt.hash('Student@LmsSecure#2026', 10);

  const studentUser1 = await prisma.user.create({
    data: {
      name: 'Rahul Sharma',
      email: 'student1@college.edu',
      password_hash: studentPasswordHash,
      role: 'STUDENT',
      phone: '+91 91234 56789',
      is_active: true,
      student_profile: {
        create: {
          student_id: 'CS2024001',
          qr_code_token: 'QR-STU-CS2024001',
          enrollment_number: 'EN2024CS01',
          department: 'Computer Science & Engineering',
          course: 'B.Tech CSE',
          semester: '4th Semester',
          year: '2nd Year',
          address: 'Block B, Campus Hostel #3, University Town',
          date_of_birth: new Date('2004-05-15')
        }
      }
    },
    include: { student_profile: true }
  });

  const studentUser2 = await prisma.user.create({
    data: {
      name: 'Priya Patel',
      email: 'student2@college.edu',
      password_hash: studentPasswordHash,
      role: 'STUDENT',
      phone: '+91 98765 12345',
      is_active: true,
      student_profile: {
        create: {
          student_id: 'IT2024003',
          qr_code_token: 'QR-STU-IT2024003',
          enrollment_number: 'EN2024IT03',
          department: 'Information Technology',
          course: 'B.Tech IT',
          semester: '6th Semester',
          year: '3rd Year',
          address: '42 Pine Residency, City Center',
          date_of_birth: new Date('2003-08-22')
        }
      }
    },
    include: { student_profile: true }
  });

  const studentUser3 = await prisma.user.create({
    data: {
      name: 'Aman Verma',
      email: 'student3@college.edu',
      password_hash: studentPasswordHash,
      role: 'STUDENT',
      phone: '+91 99887 76655',
      is_active: true,
      student_profile: {
        create: {
          student_id: 'ME2024007',
          qr_code_token: 'QR-STU-ME2024007',
          enrollment_number: 'EN2025ME07',
          department: 'Mechanical Engineering',
          course: 'B.Tech ME',
          semester: '2nd Semester',
          year: '1st Year',
          address: '15 Lakeview Heights, North Campus',
          date_of_birth: new Date('2002-11-10')
        }
      }
    },
    include: { student_profile: true }
  });
  console.log('✓ Seeded 3 Student accounts (student1@college.edu / Student@LmsSecure#2026).');

  // 9. Seed Initial Issues, Overdue Fines & Requests
  const now = new Date();
  const issueDateActive = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const dueDateActive = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000);

  // Active Issue for Rahul: Atomic Habits
  await prisma.issuedBook.create({
    data: {
      student_id: studentUser1.student_profile.id,
      book_id: createdBooks[0].id,
      issued_by: adminUser.id,
      issue_date: issueDateActive,
      due_date: dueDateActive,
      status: 'ISSUED',
      renewal_count: 0
    }
  });

  // Overdue Issue for Rahul: The Psychology of Money (14 days overdue)
  const issueDateOverdue = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const dueDateOverdue = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const overdueIssue = await prisma.issuedBook.create({
    data: {
      student_id: studentUser1.student_profile.id,
      book_id: createdBooks[1].id,
      issued_by: adminUser.id,
      issue_date: issueDateOverdue,
      due_date: dueDateOverdue,
      status: 'OVERDUE',
      renewal_count: 1
    }
  });

  // Fine for late book
  await prisma.fine.create({
    data: {
      issue_id: overdueIssue.id,
      student_id: studentUser1.student_profile.id,
      amount: 70.00,
      reason: 'Overdue penalty: 14 days past due date',
      status: 'UNPAID'
    }
  });

  // Request for The 5 AM Club
  await prisma.bookIssueRequest.create({
    data: {
      student_id: studentUser2.student_profile.id,
      book_id: createdBooks[3].id,
      status: 'PENDING',
      request_date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    }
  });

  // Seed Student Memberships (Monthly passes)
  await prisma.studentMembership.createMany({
    data: [
      {
        student_id: studentUser1.student_profile.id,
        plan_name: 'Monthly Student Pass',
        monthly_fee: 500.00,
        fee_status: 'PAID',
        valid_from: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        valid_until: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
        paid_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        payment_method: 'UPI (PhonePe)',
        receipt_number: 'REC-2026-001'
      },
      {
        student_id: studentUser2.student_profile.id,
        plan_name: 'Monthly Student Pass',
        monthly_fee: 500.00,
        fee_status: 'PENDING',
        valid_from: now,
        valid_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        student_id: studentUser3.student_profile.id,
        plan_name: 'Monthly Student Pass',
        monthly_fee: 500.00,
        fee_status: 'PAID',
        valid_from: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        valid_until: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
        paid_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        payment_method: 'Cash at Desk',
        receipt_number: 'REC-2026-003'
      }
    ]
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        user_id: studentUser1.id,
        title: 'Book Due Reminder',
        message: 'Your loan for "The Psychology of Money" is 14 days overdue. Please return it promptly.',
        type: 'BOOK_OVERDUE',
        is_read: false
      },
      {
        user_id: adminUser.id,
        title: 'New Book Issue Request',
        message: 'Student Priya Patel (IT2024003) has requested "The 5 AM Club".',
        type: 'BOOK_REQUEST',
        is_read: false
      }
    ]
  });

  // Activity Logs
  await prisma.employeeActivityLog.createMany({
    data: [
      {
        user_id: adminUser.id,
        action: 'BOOK_CREATED',
        entity: 'Book',
        entity_id: createdBooks[0].id,
        details: 'Added "Atomic Habits" to catalog inventory.'
      },
      {
        user_id: adminUser.id,
        action: 'BOOK_ISSUED',
        entity: 'IssuedBook',
        entity_id: 1,
        details: 'Issued "Atomic Habits" to student Rahul Sharma.'
      }
    ]
  });

  // Seed Student Attendance Records
  const todayMorning = new Date();
  todayMorning.setHours(9, 15, 0, 0);

  const yesterdayMorning = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  yesterdayMorning.setHours(9, 30, 0, 0);
  const yesterdayEvening = new Date(yesterdayMorning.getTime() + 3 * 60 * 60 * 1000);

  await prisma.studentAttendance.createMany({
    data: [
      {
        student_id: studentUser1.student_profile.id,
        date: new Date(),
        check_in: todayMorning,
        status: 'PRESENT',
        scanned_by: adminUser.id,
        scan_mode: 'QR_SCAN',
        notes: 'Scanned at Central Library Entry Gate'
      },
      {
        student_id: studentUser2.student_profile.id,
        date: new Date(),
        check_in: new Date(todayMorning.getTime() + 45 * 60 * 1000),
        status: 'PRESENT',
        scanned_by: employeeUser.id,
        scan_mode: 'QR_SCAN',
        notes: 'Scanned at Circulation Desk'
      },
      {
        student_id: studentUser1.student_profile.id,
        date: yesterdayMorning,
        check_in: yesterdayMorning,
        check_out: yesterdayEvening,
        status: 'PRESENT',
        scanned_by: adminUser.id,
        scan_mode: 'QR_SCAN',
        notes: 'Study session in Reading Room B'
      },
      {
        student_id: studentUser3.student_profile.id,
        date: yesterdayMorning,
        check_in: new Date(yesterdayMorning.getTime() + 90 * 60 * 1000),
        check_out: new Date(yesterdayMorning.getTime() + 4 * 60 * 60 * 1000),
        status: 'LATE',
        scanned_by: employeeUser.id,
        scan_mode: 'MANUAL',
        notes: 'Manual entry by staff'
      }
    ]
  });

  console.log('✓ Seeded sample issues, overdue fines, requests, attendance records, notifications, and activity logs.');
  console.log('🎉 Database seeding completed with ONLY user Books!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
