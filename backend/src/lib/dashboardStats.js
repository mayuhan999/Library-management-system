const { prisma } = require('./prisma');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getLibrarianDashboard() {
  const today = startOfToday();
  const now = new Date();

  const [
    todayCheckouts,
    todayReturns,
    activeLoans,
    overdueLoans,
    pendingHolds,
    readyHolds,
    openIncidents,
    todayDeskBorrow,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: { action: 'BORROW', createdAt: { gte: today } },
    }),
    prisma.auditLog.count({
      where: { action: 'RETURN', createdAt: { gte: today } },
    }),
    prisma.loan.count({ where: { status: 'BORROWED', returnedAt: null } }),
    prisma.loan.count({
      where: { status: 'BORROWED', returnedAt: null, dueAt: { lt: now } },
    }),
    prisma.hold.count({ where: { status: { in: ['ACTIVE', 'APPROVED'] } } }),
    prisma.hold.count({ where: { status: 'READY' } }),
    prisma.bookCopyIncident.count({
      where: { createdAt: { gte: daysAgo(30) } },
    }),
    prisma.loan.count({ where: { borrowedAt: { gte: today } } }),
  ]);

  const recentActivity = await prisma.auditLog.findMany({
    where: { action: { in: ['BORROW', 'RETURN', 'APPROVE', 'REJECT'] } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { user: { select: { fullName: true, role: true } } },
  });

  return {
    summary: {
      todayCheckouts: Math.max(todayCheckouts, todayDeskBorrow),
      todayReturns,
      activeLoans,
      overdueLoans,
      pendingHolds,
      readyHolds,
      incidentsLast30Days: openIncidents,
    },
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      createdAt: a.createdAt,
      actor: a.user?.fullName,
      actorRole: a.user?.role,
    })),
  };
}

async function getAdminDashboard() {
  const today = startOfToday();
  const weekAgo = daysAgo(7);
  const now = new Date();

  const [
    totalBooks,
    copyAgg,
    totalUsers,
    readers,
    activeLoans,
    overdueLoans,
    fineAgg,
    unpaidFineAgg,
    paymentsToday,
    paymentRevenue,
    pendingPayments,
  ] = await Promise.all([
    prisma.book.count(),
    prisma.book.aggregate({ _sum: { totalCopies: true, availableCopies: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { role: 'MEMBER' } }),
    prisma.loan.count({ where: { status: 'BORROWED', returnedAt: null } }),
    prisma.loan.count({
      where: { status: 'BORROWED', returnedAt: null, dueAt: { lt: now } },
    }),
    prisma.loan.aggregate({
      _sum: { fineAmount: true },
      where: { fineAmount: { gt: 0 } },
    }),
    prisma.loan.aggregate({
      _sum: { fineAmount: true },
      where: { fineAmount: { gt: 0 }, finePaid: false },
    }),
    prisma.payment.count({
      where: { status: 'SUCCESS', paidAt: { gte: today } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' },
    }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
  ]);

  const loansLast7 = await prisma.loan.findMany({
    where: { borrowedAt: { gte: weekAgo } },
    select: { borrowedAt: true },
  });

  const returnsLast7 = await prisma.loan.findMany({
    where: { returnedAt: { gte: weekAgo } },
    select: { returnedAt: true },
  });

  const byDay = {};
  for (let i = 6; i >= 0; i -= 1) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { date: key, borrows: 0, returns: 0 };
  }

  for (const row of loansLast7) {
    const key = row.borrowedAt.toISOString().slice(0, 10);
    if (byDay[key]) byDay[key].borrows += 1;
  }
  for (const row of returnsLast7) {
    if (!row.returnedAt) continue;
    const key = row.returnedAt.toISOString().slice(0, 10);
    if (byDay[key]) byDay[key].returns += 1;
  }

  const categoryBreakdown = await prisma.book.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 6,
  });

  return {
    summary: {
      totalBooks,
      totalCopies: copyAgg._sum.totalCopies || 0,
      availableCopies: copyAgg._sum.availableCopies || 0,
      totalUsers,
      readers,
      activeLoans,
      overdueLoans,
      fineRevenueTotal: parseFloat((fineAgg._sum.fineAmount || 0).toFixed(2)),
      fineRevenuePaid: parseFloat(((fineAgg._sum.fineAmount || 0) - (unpaidFineAgg._sum.fineAmount || 0)).toFixed(2)),
      fineRevenueUnpaid: parseFloat((unpaidFineAgg._sum.fineAmount || 0).toFixed(2)),
      alipayPaymentsToday: paymentsToday,
      alipayRevenueTotal: parseFloat((paymentRevenue._sum.amount || 0).toFixed(2)),
      pendingPayments,
    },
    circulationTrend: Object.values(byDay),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category || 'Uncategorized',
      count: c._count.id,
    })),
  };
}

module.exports = { getLibrarianDashboard, getAdminDashboard };
