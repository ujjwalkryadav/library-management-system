const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { requirePermission } = require('../middleware/permissionAuth');
const { uploadCover } = require('../middleware/upload');
const { validateBook } = require('../middleware/validation');

// Public / Authenticated catalog browsing
router.get('/api/search', bookController.searchSuggestions);
router.get('/', bookController.listBooks);
router.get('/:id', bookController.showBook);

// Staff & Admin Book Operations with granular permissions
router.get('/admin/create', requirePermission('books.create'), bookController.renderCreateBook);
router.post('/admin/create', requirePermission('books.create'), uploadCover.single('coverImage'), validateBook, bookController.handleCreateBook);
router.get('/admin/:id/edit', requirePermission('books.edit'), bookController.renderEditBook);
router.post('/admin/:id/update', requirePermission('books.edit'), uploadCover.single('coverImage'), validateBook, bookController.handleUpdateBook);
router.post('/admin/:id/delete', requirePermission('books.delete'), bookController.handleDeleteBook);

module.exports = router;
