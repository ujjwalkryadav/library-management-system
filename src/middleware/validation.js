function validateRegister(req, res, next) {
  const { name, email, password, confirmPassword, studentId, department, course } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Full Name must be at least 2 characters.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Please enter a valid academic or personal email address.');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  if (!studentId || studentId.trim().length < 3) {
    errors.push('Valid Student Roll/Registration ID is required.');
  }

  if (!department || department.trim().length < 2) {
    errors.push('Department is required.');
  }

  if (!course || course.trim().length < 2) {
    errors.push('Course/Program is required.');
  }

  if (errors.length > 0) {
    req.validationErrors = errors;
  }

  next();
}

function validateBook(req, res, next) {
  const { title, authorId, categoryId, totalCopies } = req.body;
  const errors = [];

  if (!title || title.trim().length < 1) {
    errors.push('Book Title is required.');
  }

  if (!authorId || isNaN(parseInt(authorId, 10))) {
    errors.push('Valid Author must be selected.');
  }

  if (!categoryId || isNaN(parseInt(categoryId, 10))) {
    errors.push('Valid Category must be selected.');
  }

  const copies = parseInt(totalCopies, 10);
  if (isNaN(copies) || copies < 1) {
    errors.push('Total copies must be at least 1.');
  }

  if (errors.length > 0) {
    req.validationErrors = errors;
  }

  next();
}

module.exports = {
  validateRegister,
  validateBook
};
