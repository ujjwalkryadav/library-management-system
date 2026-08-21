const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authorController = require('../controllers/authorController');
const categoryController = require('../controllers/categoryController');
const settingController = require('../controllers/settingController');
const employeeController = require('../controllers/employeeController');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/permissionAuth');

// All admin/staff routes require authentication
router.use(requireAuth);

// 1. Strictly Admin-Only Routes
router.get('/dashboard', requireAdmin, adminController.renderDashboard);

// Employee Management (Strictly Admin only)
router.get('/employees', requireAdmin, employeeController.listEmployees);
router.get('/employees/create', requireAdmin, employeeController.renderCreateEmployee);
router.post('/employees', requireAdmin, employeeController.handleCreateEmployee);
router.get('/employees/logs', requireAdmin, employeeController.viewEmployeeLogs);
router.get('/employees/:id/permissions', requireAdmin, employeeController.renderManagePermissions);
router.post('/employees/:id/permissions', requireAdmin, employeeController.handleUpdatePermissions);
router.post('/employees/:id/toggle-status', requireAdmin, employeeController.toggleEmployeeStatus);

// Settings (Strictly Admin only)
router.get('/settings', requireAdmin, settingController.listSettings);
router.post('/settings', requireAdmin, settingController.handleUpdateSettings);

// 2. Permission-Controlled Operations (Accessible to Admin and Authorized Employees)
// Students
router.get('/students', requirePermission('students.view'), adminController.listStudents);
router.get('/students/:id', requirePermission('students.view'), adminController.viewStudent);
router.get('/students/:id/edit', requirePermission('students.edit'), adminController.renderEditStudent);
router.post('/students/:id/update', requirePermission('students.edit'), adminController.handleUpdateStudent);
router.post('/students/:id/toggle-status', requirePermission('students.edit'), adminController.toggleStudentStatus);

// Authors
router.get('/authors', requirePermission('authors.view'), authorController.listAuthors);
router.post('/authors', requirePermission('authors.create'), authorController.createAuthor);
router.post('/authors/:id/update', requirePermission('authors.edit'), authorController.updateAuthor);
router.post('/authors/:id/delete', requirePermission('authors.delete'), authorController.deleteAuthor);

// Categories
router.get('/categories', requirePermission('categories.view'), categoryController.listCategories);
router.post('/categories', requirePermission('categories.create'), categoryController.createCategory);
router.post('/categories/:id/update', requirePermission('categories.edit'), categoryController.updateCategory);
router.post('/categories/:id/delete', requirePermission('categories.delete'), categoryController.deleteCategory);

// Transactions audit log
router.get('/transactions', requirePermission('reports.view'), adminController.listTransactions);

// Profile
router.get('/profile', adminController.renderProfile);
router.post('/profile', adminController.handleUpdateProfile);

module.exports = router;
