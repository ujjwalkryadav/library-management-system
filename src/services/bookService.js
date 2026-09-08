const { prisma } = require('../config/database');

async function getBooks({ search = '', categoryId, authorId, availability, sort = 'newest', isArchived = false, skip = 0, limit = 10 }) {
  const where = {
    is_archived: isArchived
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { isbn: { contains: q, mode: 'insensitive' } },
      { author: { name: { contains: q, mode: 'insensitive' } } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
      { publisher: { contains: q, mode: 'insensitive' } }
    ];
  }

  if (categoryId) {
    where.category_id = parseInt(categoryId, 10);
  }

  if (authorId) {
    where.author_id = parseInt(authorId, 10);
  }

  if (availability === 'available') {
    where.available_copies = { gt: 0 };
  } else if (availability === 'unavailable' || availability === 'out_of_stock') {
    where.available_copies = { equals: 0 };
  }

  let orderBy = { created_at: 'desc' };
  if (sort === 'title_asc') orderBy = { title: 'asc' };
  else if (sort === 'title_desc') orderBy = { title: 'desc' };
  else if (sort === 'popular') orderBy = { total_copies: 'desc' };

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where,
      include: {
        author: true,
        category: true,
        _count: {
          select: {
            issues: { where: { status: { in: ['ISSUED', 'OVERDUE'] } } },
            requests: { where: { status: 'PENDING' } }
          }
        }
      },
      orderBy,
      skip,
      take: limit
    }),
    prisma.book.count({ where })
  ]);

  return { books, total };
}

async function getBookById(id) {
  return prisma.book.findUnique({
    where: { id: parseInt(id, 10) },
    include: {
      author: true,
      category: true,
      issues: {
        include: {
          student: { include: { user: true } }
        },
        orderBy: { issue_date: 'desc' }
      },
      requests: {
        include: {
          student: { include: { user: true } }
        },
        orderBy: { request_date: 'desc' }
      }
    }
  });
}

async function createBook(data) {
  const { title, isbn, description, authorId, categoryId, publisher, publicationYear, language, totalCopies, shelfLocation, coverImage } = data;

  const copies = parseInt(totalCopies, 10) || 1;

  if (isbn && isbn.trim()) {
    const existing = await prisma.book.findUnique({
      where: { isbn: isbn.trim() }
    });
    if (existing) {
      throw new Error(`A book with ISBN ${isbn.trim()} already exists.`);
    }
  }

  return prisma.book.create({
    data: {
      title: title.trim(),
      isbn: isbn && isbn.trim() ? isbn.trim() : null,
      description: description ? description.trim() : null,
      author_id: parseInt(authorId, 10),
      category_id: parseInt(categoryId, 10),
      publisher: publisher ? publisher.trim() : null,
      publication_year: publicationYear ? parseInt(publicationYear, 10) : null,
      language: language ? language.trim() : 'English',
      total_copies: copies,
      available_copies: copies,
      shelf_location: shelfLocation ? shelfLocation.trim() : null,
      cover_image: coverImage || null
    },
    include: {
      author: true,
      category: true
    }
  });
}

async function updateBook(id, data) {
  const bookId = parseInt(id, 10);
  const currentBook = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      issues: {
        where: { status: { in: ['ISSUED', 'OVERDUE'] } }
      }
    }
  });

  if (!currentBook) {
    throw new Error('Book not found.');
  }

  const { title, isbn, description, authorId, categoryId, publisher, publicationYear, language, totalCopies, shelfLocation, coverImage } = data;

  // Check unique ISBN if changed
  if (isbn && isbn.trim() && isbn.trim() !== currentBook.isbn) {
    const existing = await prisma.book.findUnique({
      where: { isbn: isbn.trim() }
    });
    if (existing && existing.id !== bookId) {
      throw new Error(`ISBN ${isbn.trim()} is already used by another book.`);
    }
  }

  const activeIssuedCount = currentBook.issues.length;
  let newTotal = parseInt(totalCopies, 10);
  if (isNaN(newTotal) || newTotal < 1) {
    newTotal = currentBook.total_copies;
  }

  if (newTotal < activeIssuedCount) {
    throw new Error(`Cannot reduce total copies to ${newTotal} because ${activeIssuedCount} copies are currently issued to students.`);
  }

  // Calculate new available copies maintaining consistency
  const copyDifference = newTotal - currentBook.total_copies;
  let newAvailable = currentBook.available_copies + copyDifference;
  if (newAvailable < 0) newAvailable = 0;
  if (newAvailable > newTotal) newAvailable = newTotal;

  const updateData = {
    title: title ? title.trim() : currentBook.title,
    isbn: isbn && isbn.trim() ? isbn.trim() : null,
    description: description !== undefined ? description.trim() : currentBook.description,
    author_id: authorId ? parseInt(authorId, 10) : currentBook.author_id,
    category_id: categoryId ? parseInt(categoryId, 10) : currentBook.category_id,
    publisher: publisher !== undefined ? (publisher ? publisher.trim() : null) : currentBook.publisher,
    publication_year: publicationYear ? parseInt(publicationYear, 10) : currentBook.publication_year,
    language: language ? language.trim() : currentBook.language,
    total_copies: newTotal,
    available_copies: newAvailable,
    shelf_location: shelfLocation !== undefined ? (shelfLocation ? shelfLocation.trim() : null) : currentBook.shelf_location
  };

  if (coverImage) {
    updateData.cover_image = coverImage;
  }

  return prisma.book.update({
    where: { id: bookId },
    data: updateData,
    include: {
      author: true,
      category: true
    }
  });
}

async function deleteOrArchiveBook(id) {
  const bookId = parseInt(id, 10);
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      issues: true,
      requests: true
    }
  });

  if (!book) {
    throw new Error('Book not found.');
  }

  const hasActiveIssues = book.issues.some(i => i.status === 'ISSUED' || i.status === 'OVERDUE');
  if (hasActiveIssues) {
    throw new Error('Cannot delete or archive this book while it is actively issued to students.');
  }

  if (book.issues.length > 0 || book.requests.length > 0) {
    // Has historical records - Soft delete / archive to preserve relational data
    await prisma.book.update({
      where: { id: bookId },
      data: { is_archived: true }
    });
    return { action: 'archived', message: 'Book archived to preserve historical transaction records.' };
  } else {
    // Clean delete
    await prisma.book.delete({
      where: { id: bookId }
    });
    return { action: 'deleted', message: 'Book permanently deleted.' };
  }
}

module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteOrArchiveBook
};
