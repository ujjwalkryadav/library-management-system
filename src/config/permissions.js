const PERMISSIONS = {
  // Dashboard
  'dashboard.view': { name: 'View Dashboard', category: 'Dashboard', desc: 'Access employee operations dashboard' },
  
  // Books
  'books.view': { name: 'View Books', category: 'Books', desc: 'Browse catalog and view book stock details' },
  'books.create': { name: 'Add Books', category: 'Books', desc: 'Add new titles and inventory copies' },
  'books.edit': { name: 'Edit Books', category: 'Books', desc: 'Update book details and metadata' },
  'books.delete': { name: 'Delete Books', category: 'Books', desc: 'Delete or archive book titles' },
  
  // Categories
  'categories.view': { name: 'View Categories', category: 'Categories', desc: 'View classification categories' },
  'categories.create': { name: 'Create Category', category: 'Categories', desc: 'Create new category classifications' },
  'categories.edit': { name: 'Edit Category', category: 'Categories', desc: 'Modify existing categories' },
  'categories.delete': { name: 'Delete Category', category: 'Categories', desc: 'Remove unused categories' },

  // Authors
  'authors.view': { name: 'View Authors', category: 'Authors', desc: 'Browse catalog author biographies' },
  'authors.create': { name: 'Add Author', category: 'Authors', desc: 'Create new author records' },
  'authors.edit': { name: 'Edit Author', category: 'Authors', desc: 'Update author biographies' },
  'authors.delete': { name: 'Delete Author', category: 'Authors', desc: 'Remove authors without linked books' },

  // Students
  'students.view': { name: 'View Students', category: 'Students', desc: 'Access student directory and profiles' },
  'students.create': { name: 'Add Students', category: 'Students', desc: 'Register or add new students' },
  'students.edit': { name: 'Edit Students', category: 'Students', desc: 'Update student academic details' },
  'students.deactivate': { name: 'Deactivate Students', category: 'Students', desc: 'Toggle active/deactivated student status' },

  // Book Requests
  'requests.view': { name: 'View Requests', category: 'Requests', desc: 'Access student book issue request queue' },
  'requests.approve': { name: 'Approve Requests', category: 'Requests', desc: 'Approve reservation requests and issue books' },
  'requests.reject': { name: 'Reject Requests', category: 'Requests', desc: 'Decline book issue reservations' },

  // Issues & Returns
  'issues.view': { name: 'View Issued Books', category: 'Circulation', desc: 'View all active and historical issued books' },
  'issues.create': { name: 'Issue Books', category: 'Circulation', desc: 'Issue books directly to students' },
  'issues.return': { name: 'Process Returns', category: 'Circulation', desc: 'Accept book returns and assess overdue fines' },

  // Fines
  'fines.view': { name: 'View Fine Ledger', category: 'Finance', desc: 'View overdue fine penalty logs' },
  'fines.create': { name: 'Assess Fines', category: 'Finance', desc: 'Manually create fine penalties' },
  'fines.update': { name: 'Update Fines', category: 'Finance', desc: 'Modify fine amounts or details' },
  'fines.mark_paid': { name: 'Mark Fine Paid', category: 'Finance', desc: 'Record fine payment receipt' },
  'fines.waive': { name: 'Waive Fine', category: 'Finance', desc: 'Waive student penalty dues' },

  // Attendance
  'attendance.view': { name: 'View Attendance Logs', category: 'Attendance', desc: 'View student daily library attendance ledger' },
  'attendance.scan': { name: 'Scan & Mark Attendance', category: 'Attendance', desc: 'Scan student QR codes / barcodes to mark attendance' },
  'attendance.manage': { name: 'Edit & Manage Attendance', category: 'Attendance', desc: 'Manually create, edit, or adjust student attendance records' },

  // Reports & Logs
  'reports.view': { name: 'View Reports & Audits', category: 'Reports', desc: 'View circulation statistics and transaction logs' },

  // Notifications
  'notifications.view': { name: 'View Notifications', category: 'Notifications', desc: 'Access system alerts and messages' }
};

// Group permissions by category for UI checklist rendering
function getGroupedPermissions() {
  const groups = {};
  for (const [key, val] of Object.entries(PERMISSIONS)) {
    if (!groups[val.category]) {
      groups[val.category] = [];
    }
    groups[val.category].push({ key, ...val });
  }
  return groups;
}

module.exports = {
  PERMISSIONS,
  getGroupedPermissions
};
