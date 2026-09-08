const bookService = require('../services/bookService');
const { prisma } = require('../config/database');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const { setFlash } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');

async function searchSuggestions(req, res) {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      return res.json({ success: true, books: [] });
    }

    const books = await prisma.book.findMany({
      where: {
        is_archived: false,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { isbn: { contains: q, mode: 'insensitive' } },
          { author: { name: { contains: q, mode: 'insensitive' } } },
          { category: { name: { contains: q, mode: 'insensitive' } } }
        ]
      },
      include: {
        author: true,
        category: true
      },
      take: 6
    });

    const results = books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author.name,
      category: b.category.name,
      cover_image: b.cover_image || '/images/default-cover.svg',
      available_copies: b.available_copies,
      is_available: b.available_copies > 0,
      shelf_location: b.shelf_location || 'General Stacks'
    }));

    return res.json({ success: true, books: results });
  } catch (error) {
    console.error('Search suggestion error:', error);
    return res.status(500).json({ success: false, error: 'Failed to query suggestions' });
  }
}

async function listBooks(req, res, next) {
  try {
    const { search, category, author, availability, sort } = req.query;
    const { page, limit, skip } = getPaginationParams(req, 12);

    const { books, total } = await bookService.getBooks({
      search,
      categoryId: category,
      authorId: author,
      availability,
      sort: sort || 'newest',
      skip,
      limit
    });

    const [categories, authors] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.author.findMany({ orderBy: { name: 'asc' } })
    ]);

    const pagination = buildPaginationMeta(total, page, limit, req.originalUrl);

    let viewPath = 'student/books/index';
    if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'EMPLOYEE')) {
      viewPath = 'admin/books/index';
    }

    res.render(viewPath, {
      title: 'Book Catalog | Library Management System',
      books,
      categories,
      authors,
      pagination,
      search: search || '',
      selectedCategory: category || '',
      selectedAuthor: author || '',
      selectedAvailability: availability || '',
      selectedSort: sort || 'newest'
    });
  } catch (error) {
    next(error);
  }
}

async function showBook(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const book = await bookService.getBookById(id);

    if (!book) {
      setFlash(req, 'error', 'Book not found.');
      return res.redirect('/books');
    }

    let studentHasActiveIssue = false;
    let studentHasPendingRequest = false;

    if (req.student) {
      studentHasActiveIssue = book.issues.some(
        i => i.student_id === req.student.id && ['ISSUED', 'OVERDUE'].includes(i.status)
      );
      studentHasPendingRequest = book.requests.some(
        r => r.student_id === req.student.id && r.status === 'PENDING'
      );
    }

    let viewPath = 'student/books/show';
    if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'EMPLOYEE')) {
      viewPath = 'admin/books/show';
    }

    res.render(viewPath, {
      title: `${book.title} | Library Management System`,
      book,
      studentHasActiveIssue,
      studentHasPendingRequest
    });
  } catch (error) {
    next(error);
  }
}

async function renderCreateBook(req, res, next) {
  try {
    const [categories, authors] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.author.findMany({ orderBy: { name: 'asc' } })
    ]);

    res.render('admin/books/create', {
      title: 'Add New Book | Library Central',
      categories,
      authors,
      formData: {}
    });
  } catch (error) {
    next(error);
  }
}

async function handleCreateBook(req, res, next) {
  try {
    const [categories, authors] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.author.findMany({ orderBy: { name: 'asc' } })
    ]);

    if (req.validationErrors && req.validationErrors.length > 0) {
      setFlash(req, 'error', req.validationErrors.join(' '));
      return res.render('admin/books/create', {
        title: 'Add New Book | Library Central',
        categories,
        authors,
        formData: req.body
      });
    }

    const coverImage = req.file ? `/uploads/covers/${req.file.filename}` : null;

    const book = await bookService.createBook({
      ...req.body,
      coverImage
    });

    await logActivity({
      userId: req.user.id,
      action: 'BOOK_CREATED',
      entity: 'Book',
      entityId: book.id,
      details: `Added new title "${book.title}" (${book.total_copies} copies)`
    });

    setFlash(req, 'success', `"${book.title}" added to library inventory successfully!`);
    res.redirect(`/books/${book.id}`);
  } catch (error) {
    setFlash(req, 'error', error.message);
    const [categories, authors] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.author.findMany({ orderBy: { name: 'asc' } })
    ]);
    return res.render('admin/books/create', {
      title: 'Add New Book | Library Central',
      categories,
      authors,
      formData: req.body
    });
  }
}

async function renderEditBook(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const [book, categories, authors] = await Promise.all([
      bookService.getBookById(id),
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.author.findMany({ orderBy: { name: 'asc' } })
    ]);

    if (!book) {
      setFlash(req, 'error', 'Book not found.');
      return res.redirect('/books');
    }

    res.render('admin/books/edit', {
      title: `Edit ${book.title} | Library Central`,
      book,
      categories,
      authors
    });
  } catch (error) {
    next(error);
  }
}

async function handleUpdateBook(req, res, next) {
  const id = parseInt(req.params.id, 10);
  try {
    const coverImage = req.file ? `/uploads/covers/${req.file.filename}` : undefined;

    const updated = await bookService.updateBook(id, {
      ...req.body,
      coverImage
    });

    await logActivity({
      userId: req.user.id,
      action: 'BOOK_UPDATED',
      entity: 'Book',
      entityId: id,
      details: `Updated title "${updated.title}"`
    });

    setFlash(req, 'success', 'Book details updated successfully.');
    res.redirect(`/books/${id}`);
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(`/books/admin/${id}/edit`);
  }
}

async function handleDeleteBook(req, res, next) {
  const id = parseInt(req.params.id, 10);
  try {
    const result = await bookService.deleteOrArchiveBook(id);

    await logActivity({
      userId: req.user.id,
      action: 'BOOK_DELETED_OR_ARCHIVED',
      entity: 'Book',
      entityId: id,
      details: result.message
    });

    setFlash(req, 'success', result.message);
    res.redirect('/books');
  } catch (error) {
    setFlash(req, 'error', error.message);
    res.redirect(`/books/${id}`);
  }
}

module.exports = {
  searchSuggestions,
  listBooks,
  showBook,
  renderCreateBook,
  handleCreateBook,
  renderEditBook,
  handleUpdateBook,
  handleDeleteBook
};
