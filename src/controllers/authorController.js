const { prisma } = require('../config/database');
const { setFlash } = require('../middleware/auth');

async function listAuthors(req, res, next) {
  try {
    const authors = await prisma.author.findMany({
      include: {
        _count: { select: { books: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.render('admin/authors/index', {
      title: 'Manage Authors | Admin',
      authors
    });
  } catch (error) {
    next(error);
  }
}

async function createAuthor(req, res, next) {
  try {
    const { name, biography } = req.body;
    if (!name || name.trim().length < 2) {
      setFlash(req, 'error', 'Author name is required (at least 2 characters).');
      return res.redirect('/admin/authors');
    }

    await prisma.author.create({
      data: {
        name: name.trim(),
        biography: biography ? biography.trim() : null
      }
    });

    setFlash(req, 'success', `Author "${name.trim()}" added successfully.`);
    res.redirect('/admin/authors');
  } catch (error) {
    next(error);
  }
}

async function updateAuthor(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, biography } = req.body;

    if (!name || name.trim().length < 2) {
      setFlash(req, 'error', 'Author name is required.');
      return res.redirect('/admin/authors');
    }

    await prisma.author.update({
      where: { id },
      data: {
        name: name.trim(),
        biography: biography ? biography.trim() : null
      }
    });

    setFlash(req, 'success', 'Author information updated.');
    res.redirect('/admin/authors');
  } catch (error) {
    next(error);
  }
}

async function deleteAuthor(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const author = await prisma.author.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } }
    });

    if (!author) {
      setFlash(req, 'error', 'Author not found.');
      return res.redirect('/admin/authors');
    }

    if (author._count.books > 0) {
      setFlash(req, 'error', `Cannot delete author "${author.name}" because ${author._count.books} book(s) are linked to this author.`);
      return res.redirect('/admin/authors');
    }

    await prisma.author.delete({ where: { id } });
    setFlash(req, 'success', `Author "${author.name}" deleted.`);
    res.redirect('/admin/authors');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor
};
