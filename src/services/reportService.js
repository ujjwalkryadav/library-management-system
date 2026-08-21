const { prisma } = require('../config/database');

async function getAdminDashboardStats() {
  const [
    totalBooksCount,
    bookCopiesAgg,
    activeIssuesCount,
    overdueIssuesCount,
    totalStudentsCount,
    pendingRequestsCount,
    unpaidFinesAgg,
    paidFinesAgg,
    verifFinesAgg,
    paidMembershipsAgg,
    pendingMembershipsAgg,
    verifMembershipsAgg,
    returnedCount
  ] = await Promise.all([
    prisma.book.count({ where: { is_archived: false } }),
    prisma.book.aggregate({
      _sum: { total_copies: true, available_copies: true },
      where: { is_archived: false }
    }),
    prisma.issuedBook.count({ where: { status: 'ISSUED' } }),
    prisma.issuedBook.count({ where: { status: 'OVERDUE' } }),
    prisma.studentProfile.count(),
    prisma.bookIssueRequest.count({ where: { status: 'PENDING' } }),
    // Fines Aggregations
    prisma.fine.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { status: 'UNPAID' }
    }),
    prisma.fine.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { status: 'PAID' }
    }),
    prisma.fine.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { status: 'UNDER_VERIFICATION' }
    }),
    // Memberships Aggregations
    prisma.studentMembership.aggregate({
      _sum: { monthly_fee: true },
      _count: { id: true },
      where: { fee_status: 'PAID' }
    }),
    prisma.studentMembership.aggregate({
      _sum: { monthly_fee: true },
      _count: { id: true },
      where: { fee_status: 'PENDING' }
    }),
    prisma.studentMembership.aggregate({
      _sum: { monthly_fee: true },
      _count: { id: true },
      where: { fee_status: 'UNDER_VERIFICATION' }
    }),
    prisma.issuedBook.count({ where: { status: 'RETURNED' } })
  ]);

  // Financial Computations
  const paidMembershipTotal = paidMembershipsAgg._sum.monthly_fee ? parseFloat(paidMembershipsAgg._sum.monthly_fee) : 0;
  const pendingMembershipTotal = pendingMembershipsAgg._sum.monthly_fee ? parseFloat(pendingMembershipsAgg._sum.monthly_fee) : 0;
  const verifMembershipTotal = verifMembershipsAgg._sum.monthly_fee ? parseFloat(verifMembershipsAgg._sum.monthly_fee) : 0;

  const paidFinesTotal = paidFinesAgg._sum.amount ? parseFloat(paidFinesAgg._sum.amount) : 0;
  const unpaidFinesTotal = unpaidFinesAgg._sum.amount ? parseFloat(unpaidFinesAgg._sum.amount) : 0;
  const verifFinesTotal = verifFinesAgg._sum.amount ? parseFloat(verifFinesAgg._sum.amount) : 0;

  const totalRevenueReceived = paidMembershipTotal + paidFinesTotal;
  const totalPendingDues = pendingMembershipTotal + unpaidFinesTotal;
  const totalUnderVerificationAmount = verifMembershipTotal + verifFinesTotal;
  const totalVerificationCount = (verifMembershipsAgg._count.id || 0) + (verifFinesAgg._count.id || 0);

  // Recent pending requests
  const recentRequests = await prisma.bookIssueRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      book: true,
      student: { include: { user: true } }
    },
    orderBy: { request_date: 'desc' },
    take: 5
  });

  // Overdue books list for table in dashboard
  const overdueBooks = await prisma.issuedBook.findMany({
    where: { status: 'OVERDUE' },
    include: {
      book: true,
      student: { include: { user: true } }
    },
    orderBy: { due_date: 'asc' },
    take: 5
  });

  // Recent activities feed from activity log
  const recentActivities = await prisma.employeeActivityLog.findMany({
    include: {
      user: {
        include: { employee_profile: true }
      }
    },
    orderBy: { created_at: 'desc' },
    take: 6
  });

  // Category distribution for Doughnut chart
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { books: true } }
    },
    orderBy: { name: 'asc' }
  });

  const categoryLabels = categories.map(c => c.name);
  const categoryCounts = categories.map(c => c._count.books);

  // Monthly trends (last 6 months) for Books Issued Overview Line Chart
  const monthlyLabels = [];
  const monthlyIssues = [];
  const monthlyReturns = [];

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString('en-US', { month: 'short' });
    monthlyLabels.push(monthName);

    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const issueCount = await prisma.issuedBook.count({
      where: {
        issue_date: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    const returnCount = await prisma.issuedBook.count({
      where: {
        returned_date: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    monthlyIssues.push(issueCount);
    monthlyReturns.push(returnCount);
  }

  return {
    kpis: {
      totalBooks: totalBooksCount,
      totalCopies: bookCopiesAgg._sum.total_copies || 0,
      availableCopies: bookCopiesAgg._sum.available_copies || 0,
      activeIssues: activeIssuesCount,
      overdueIssues: overdueIssuesCount,
      totalStudents: totalStudentsCount,
      pendingRequests: pendingRequestsCount,
      returnedCount: returnedCount,
      // Fines
      unpaidFinesCount: unpaidFinesAgg._count.id || 0,
      unpaidFinesTotal: unpaidFinesTotal,
      paidFinesCount: paidFinesAgg._count.id || 0,
      paidFinesTotal: paidFinesTotal,
      // Memberships
      paidMembershipsCount: paidMembershipsAgg._count.id || 0,
      paidMembershipTotal: paidMembershipTotal,
      pendingMembershipsCount: pendingMembershipsAgg._count.id || 0,
      pendingMembershipTotal: pendingMembershipTotal,
      // Combined Financial Stats
      totalRevenueReceived,
      totalPendingDues,
      totalUnderVerificationAmount,
      totalVerificationCount
    },
    recentRequests,
    overdueBooks,
    recentActivities,
    charts: {
      categories: { labels: categoryLabels, data: categoryCounts },
      monthlyTrends: { labels: monthlyLabels, issues: monthlyIssues, returns: monthlyReturns }
    }
  };
}

module.exports = {
  getAdminDashboardStats
};
