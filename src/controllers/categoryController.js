const { prisma } = require('../config/database');
const { setFlash } = require('../middleware/auth');

async function listCategories(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { books: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.render('admin/categories/index', {
      title: 'Manage Categories | Admin',
      categories
    });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name || name.trim().length < 2) {
      setFlash(req, 'error', 'Category name is required.');
      return res.redirect('/admin/categories');
    }

    const existing = await prisma.category.findUnique({
      where: { name: name.trim() }
    });

    if (existing) {
      setFlash(req, 'error', `Category "${name.trim()}" already exists.`);
      return res.redirect('/admin/categories');
    }

    await prisma.category.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });

    setFlash(req, 'success', `Category "${name.trim()}" created successfully.`);
    res.redirect('/admin/categories');
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      setFlash(req, 'error', 'Category name is required.');
      return res.redirect('/admin/categories');
    }

    const existing = await prisma.category.findUnique({
      where: { name: name.trim() }
    });

    if (existing && existing.id !== id) {
      setFlash(req, 'error', `Category "${name.trim()}" already exists.`);
      return res.redirect('/admin/categories');
    }

    await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });

    setFlash(req, 'success', 'Category updated successfully.');
    res.redirect('/admin/categories');
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } }
    });

    if (!category) {
      setFlash(req, 'error', 'Category not found.');
      return res.redirect('/admin/categories');
    }

    if (category._count.books > 0) {
      setFlash(req, 'error', `Cannot delete category "${category.name}" because ${category._count.books} book(s) belong to this category.`);
      return res.redirect('/admin/categories');
    }

    await prisma.category.delete({ where: { id } });
    setFlash(req, 'success', `Category "${category.name}" deleted.`);
    res.redirect('/admin/categories');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
