const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getMaxRenewCount, getLoanDays, getReminderDaysAhead } = require('../lib/libraryRules');
const { processDueRemindersForUser } = require('../lib/dueReminders');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['MEMBER']));

/** Current user's loans (borrow history + active). */
router.get('/loans', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const where = { userId: req.userId };
  if (status && ['BORROWED', 'RETURNED', 'OVERDUE'].includes(status)) {
    where.status = status;
  }

  // orderBy uses id as tiebreaker to keep display order stable after renewals
  const items = await prisma.loan.findMany({
    where,
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true } },
      bookCopy: { select: { id: true, libraryBarcode: true } },
    },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  const now = new Date();
  const enriched = items.map((loan) => {
    const overdue = loan.status === 'BORROWED' && loan.dueAt < now && !loan.returnedAt;
    return { ...loan, displayStatus: overdue ? 'OVERDUE' : loan.status };
  });

  const maxRenewalsPerLoan = await getMaxRenewCount();
  res.json({ items: enriched, meta: { maxRenewalsPerLoan } });
});

/** Current user's loan history (all loans, ordered by borrowedAt descending). */
router.get('/loans/history', async (req, res) => {
  const items = await prisma.loan.findMany({
    where: { userId: req.userId },
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true } },
      bookCopy: { select: { id: true, libraryBarcode: true } },
    },
    orderBy: { borrowedAt: 'desc' },
    take: 200,
  });
  res.json({ items });
});

/** Current user's holds (reservations). */
router.get('/holds', async (req, res) => {
  const items = await prisma.hold.findMany({
    where: { userId: req.userId },
    include: { book: { select: { id: true, title: true, author: true, isbn: true, availableCopies: true } } },
    orderBy: { placedAt: 'desc' },
    take: 100,
  });
  res.json({ items });
});

/** Renew an active loan (extends due date by LOAN_DAYS, up to MAX_RENEW_COUNT times). */
router.post('/loans/:id/renew', async (req, res) => {
  const { id } = req.params;

  const loanDays = await getLoanDays();
  const maxRenew = await getMaxRenewCount();

  const loan = await prisma.loan.findUnique({ where: { id } });

  if (!loan || loan.userId !== req.userId || loan.status !== 'BORROWED') {
    return res.status(404).json({ error: 'Active loan not found' });
  }

  const now = new Date();
  if (loan.dueAt < now) {
    return res.status(409).json({ error: 'Cannot renew an overdue loan. Please return the book at the desk.' });
  }
  if (loan.renewCount >= maxRenew) {
    return res.status(409).json({
      error:
        maxRenew <= 0
          ? 'Renewals are not enabled for this library.'
          : `Maximum renewals (${maxRenew}) reached for this loan.`,
    });
  }

  const newDue = new Date(loan.dueAt.getTime());
  newDue.setDate(newDue.getDate() + loanDays);

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      dueAt: newDue,
      renewCount: loan.renewCount + 1,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Loan',
      entityId: loan.id,
      details: JSON.stringify({ action: 'RENEW', newDueAt: newDue.toISOString(), renewCount: updated.renewCount }),
    },
  });

  res.json({ loan: updated });
});

/** R1.08 — Account status center: borrowed, due soon, holds, unpaid fines. */
router.get('/account-summary', async (req, res) => {
  await processDueRemindersForUser(req.userId);

  const now = new Date();
  const reminderDays = await getReminderDaysAhead();
  const dueWindow = new Date(now);
  dueWindow.setDate(dueWindow.getDate() + reminderDays);

  const [activeLoans, holds, unpaidFines] = await Promise.all([
    prisma.loan.findMany({
      where: { userId: req.userId, status: 'BORROWED' },
      include: {
        book: { select: { id: true, title: true, author: true, isbn: true } },
        bookCopy: { select: { libraryBarcode: true } },
      },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.hold.findMany({
      where: {
        userId: req.userId,
        status: { in: ['ACTIVE', 'APPROVED', 'READY'] },
      },
      include: { book: { select: { id: true, title: true, author: true, isbn: true } } },
      orderBy: { placedAt: 'desc' },
    }),
    prisma.loan.findMany({
      where: {
        userId: req.userId,
        fineAmount: { gt: 0 },
        finePaid: false,
      },
      include: { book: { select: { title: true, isbn: true } } },
      orderBy: { returnedAt: 'desc' },
      take: 50,
    }),
  ]);

  const borrowed = activeLoans.map((loan) => {
    const overdue = loan.dueAt < now;
    const dueSoon = !overdue && loan.dueAt <= dueWindow;
    return { ...loan, displayStatus: overdue ? 'OVERDUE' : dueSoon ? 'DUE_SOON' : 'BORROWED' };
  });

  const dueSoonList = borrowed.filter((l) => l.displayStatus === 'DUE_SOON');
  const overdueList = borrowed.filter((l) => l.displayStatus === 'OVERDUE');
  const unpaidTotal = unpaidFines.reduce((sum, l) => sum + l.fineAmount, 0);

  res.json({
    borrowed,
    dueSoonList,
    overdueList,
    holds,
    unpaidFines: { items: unpaidFines, totalAmount: parseFloat(unpaidTotal.toFixed(2)) },
    meta: { reminderDaysAhead: reminderDays },
  });
});

/** R1.06 — In-app messages (due reminders, hold ready, etc.). */
router.get('/messages', async (req, res) => {
  await processDueRemindersForUser(req.userId);

  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
  const where = { userId: req.userId };
  if (unreadOnly) where.readAt = null;

  const [items, unreadCount] = await Promise.all([
    prisma.inAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.inAppMessage.count({ where: { userId: req.userId, readAt: null } }),
  ]);

  res.json({ items, unreadCount });
});

router.patch('/messages/:id/read', async (req, res) => {
  const { id } = req.params;
  const msg = await prisma.inAppMessage.findFirst({ where: { id, userId: req.userId } });
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const updated = await prisma.inAppMessage.update({
    where: { id },
    data: { readAt: new Date() },
  });
  res.json({ message: updated });
});

router.post('/messages/read-all', async (req, res) => {
  const result = await prisma.inAppMessage.updateMany({
    where: { userId: req.userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ updated: result.count });
});

/** Reader cancels own active hold. */
router.delete('/holds/:id', async (req, res) => {
  const { id } = req.params;
  const hold = await prisma.hold.findFirst({
    where: {
      id,
      userId: req.userId,
      status: { in: ['ACTIVE', 'APPROVED', 'READY'] },
    },
  });
  if (!hold) return res.status(404).json({ error: 'Active reservation not found' });

  const updated = await prisma.hold.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Cancelled by reader' },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Hold',
      entityId: id,
      details: JSON.stringify({ newStatus: 'CANCELLED', by: 'READER' }),
    },
  });

  res.json({ hold: updated });
});

/** Mark unpaid fine as paid (reader self-service acknowledgment). */
router.post('/fines/:loanId/pay', async (req, res) => {
  const { loanId } = req.params;
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId: req.userId, fineAmount: { gt: 0 }, finePaid: false },
  });
  if (!loan) return res.status(404).json({ error: 'Unpaid fine not found' });

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { finePaid: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Loan',
      entityId: loanId,
      details: JSON.stringify({ action: 'FINE_PAID', amount: loan.fineAmount }),
    },
  });

  res.json({ loan: updated });
});

module.exports = router;
