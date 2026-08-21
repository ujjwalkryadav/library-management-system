const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

async function registerStudent(data) {
  const { name, email, password, phone, studentId, enrollmentNumber, department, course, semester, year, address, dateOfBirth } = data;

  // Check existing user email
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  });
  if (existingUser) {
    throw new Error('An account with this email address already exists.');
  }

  // Check unique student_id
  const existingProfile = await prisma.studentProfile.findUnique({
    where: { student_id: studentId.trim() }
  });
  if (existingProfile) {
    throw new Error('A student profile with this Student ID / Roll Number already exists.');
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, 10);

  // Create User + Student Profile atomically
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      role: 'STUDENT',
      phone: phone ? phone.trim() : null,
      is_active: true,
      student_profile: {
        create: {
          student_id: studentId.trim(),
          enrollment_number: enrollmentNumber ? enrollmentNumber.trim() : null,
          department: department.trim(),
          course: course.trim(),
          semester: semester ? semester.trim() : null,
          year: year ? year.trim() : null,
          address: address ? address.trim() : null,
          date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null
        }
      }
    },
    include: {
      student_profile: true
    }
  });

  return user;
}

async function verifyLogin(email, password, requiredRole = null) {
  if (!email || !password) {
    throw new Error('Please provide both email and password.');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { student_profile: true, employee_profile: true }
  });

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  if (!user.is_active) {
    throw new Error('This account has been deactivated. Please contact the administrator.');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  // Strict Role Matching Enforcement
  if (requiredRole && requiredRole.trim()) {
    const normRequired = requiredRole.trim().toUpperCase();
    if (user.role !== normRequired) {
      const roleDisplayNames = {
        STUDENT: 'Student',
        EMPLOYEE: 'Employee',
        ADMIN: 'Admin'
      };
      const reqName = roleDisplayNames[normRequired] || normRequired;
      const actualName = roleDisplayNames[user.role] || user.role;
      throw new Error(`Role Mismatch: You selected "${reqName}" login, but this account belongs to "${actualName}". Please switch to the ${actualName} tab to sign in.`);
    }
  }

  return user;
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found.');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new Error('Current password does not match.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password_hash: newHash }
  });

  return true;
}

module.exports = {
  registerStudent,
  verifyLogin,
  changePassword
};
