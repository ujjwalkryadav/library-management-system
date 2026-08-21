const { prisma } = require('../config/database');

async function renderHomepage(req, res, next) {
  try {
    if (req.user) {
      if (req.user.role === 'ADMIN') return res.redirect('/admin/dashboard');
      if (req.user.role === 'EMPLOYEE') return res.redirect('/employee/dashboard');
      if (req.user.role === 'STUDENT') return res.redirect('/student/dashboard');
    }

    // Live library statistics from PostgreSQL
    const [
      totalBooks,
      copiesAgg,
      totalStudents,
      issuedBooksCount
    ] = await Promise.all([
      prisma.book.count({ where: { is_archived: false } }),
      prisma.book.aggregate({
        _sum: { total_copies: true, available_copies: true },
        where: { is_archived: false }
      }),
      prisma.studentProfile.count(),
      prisma.issuedBook.count({ where: { status: { in: ['ISSUED', 'OVERDUE'] } } })
    ]);

    const totalPhysicalCopies = copiesAgg._sum.total_copies || 0;
    const availableCopies = copiesAgg._sum.available_copies || 0;
    const availabilityPercent = totalPhysicalCopies > 0 
      ? Math.round((availableCopies / totalPhysicalCopies) * 100) 
      : 100;

    // Featured collection books for the horizontal carousel
    const featuredBooks = await prisma.book.findMany({
      where: { is_archived: false },
      include: {
        author: true,
        category: true
      },
      orderBy: { created_at: 'asc' },
      take: 12
    });

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      take: 6
    });

    res.render('index', {
      title: 'Library Management System | Academic Excellence',
      stats: {
        totalBooks,
        totalPhysicalCopies,
        availableCopies,
        totalStudents,
        issuedBooksCount,
        availabilityPercent
      },
      featuredBooks,
      categories
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  renderHomepage
};
