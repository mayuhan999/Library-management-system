const express = require('express');
const { prisma } = require('../lib/prisma');
const { getLoanDays } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['MEMBER']));

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Current user's loans (borrow history + active). */
router.get('/loans', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const where = { userId: req.userId };
  if (status && ['BORROWED', 'RETURNED', 'OVERDUE'].includes(status)) {
    where.status = status;
  }

  const items = await prisma.loan.findMany({
    where,
    include: { book: { select: { id: true, title: true, author: true, isbn: true } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    take: 200,
  });

  const now = new Date();
  const enriched = items.map((loan) => {
    const overdue =
      loan.status === 'BORROWED' && loan.dueAt < now && !loan.returnedAt;
    return {
      ...loan,
      displayStatus: overdue ? 'OVERDUE' : loan.status,
    };
  });

  res.json({ items: enriched });
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

/** Renew an active loan (extends due date by LOAN_DAYS once). */
router.post('/loans/:id/renew', async (req, res) => {
  const loanDays = await getLoanDays();
  const { id } = req.params;

  const loan = await prisma.loan.findFirst({
    where: { id, userId: req.userId, status: 'BORROWED' },
    include: { book: true },
  });
  if (!loan) {
    return res.status(404).json({ error: 'Active loan not found' });
  }
  const now = new Date();
  if (loan.dueAt < now) {
    return res.status(409).json({ error: 'Cannot renew an overdue loan. Please return the book at the desk.' });
  }

  const newDue = addDays(loan.dueAt > now ? loan.dueAt : now, loanDays);

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: { dueAt: newDue },
    include: { book: { select: { id: true, title: true, author: true, isbn: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Loan',
      entityId: loan.id,
      details: JSON.stringify({ action: 'RENEW', newDueAt: newDue.toISOString() }),
    },
  });

  res.json({ loan: updated });
});

module.exports = router;
