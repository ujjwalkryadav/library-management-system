function formatDate(date, format = 'medium') {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';

  if (format === 'input') {
    // YYYY-MM-DD for HTML5 date inputs
    return d.toISOString().split('T')[0];
  }

  const options = {
    year: 'numeric',
    month: format === 'short' ? 'numeric' : 'short',
    day: 'numeric'
  };

  if (format === 'datetime') {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return d.toLocaleDateString('en-US', options);
}

function calculateDueDate(fromDate = new Date(), loanPeriodDays = 14) {
  const start = new Date(fromDate);
  const due = new Date(start.getTime() + loanPeriodDays * 24 * 60 * 60 * 1000);
  return due;
}

function calculateOverdueDays(dueDate, compareDate = new Date()) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const compare = new Date(compareDate);

  // Strip time parts for pure calendar day calculation
  due.setHours(0, 0, 0, 0);
  compare.setHours(0, 0, 0, 0);

  const diffMs = compare.getTime() - due.getTime();
  if (diffMs <= 0) return 0;

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return days;
}

function getDaysRemaining(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();

  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return days;
}

module.exports = {
  formatDate,
  calculateDueDate,
  calculateOverdueDays,
  getDaysRemaining
};
