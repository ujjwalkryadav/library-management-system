const { formatDate, calculateOverdueDays, getDaysRemaining } = require('./dateUtils');

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncateText(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength).trim() + '...';
}

function getStatusBadge(status) {
  switch (status) {
    case 'APPROVED':
    case 'ISSUED':
    case 'PAID':
      return { class: 'bg-success', label: status };
    case 'PENDING':
    case 'UNPAID':
      return { class: 'bg-warning text-dark', label: status };
    case 'OVERDUE':
    case 'REJECTED':
      return { class: 'bg-danger', label: status };
    case 'RETURNED':
    case 'WAIVED':
    case 'CANCELLED':
      return { class: 'bg-secondary', label: status };
    default:
      return { class: 'bg-info', label: status };
  }
}

module.exports = {
  formatDate,
  calculateOverdueDays,
  getDaysRemaining,
  formatCurrency,
  truncateText,
  getStatusBadge
};
