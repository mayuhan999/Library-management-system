const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

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
    include: { book: { select: { id: true, title: true, author: true, isbn: true } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  const now = new Date();
  const enriched = items.map((loan) => {
    const overdue = loan.status === 'BORROWED' && loan.dueAt < now && !loan.returnedAt;
    return { ...loan, displayStatus: overdue ? 'OVERDUE' : loan.status };
  });

  res.json({ items: enriched });
});

/** Current user's loan history (all loans, ordered by borrowedAt descending). */
router.get('/loans/history', async (req, res) => {
  const items = await prisma.loan.findMany({
    where: { userId: req.userId },
    include: { book: { select: { id: true, title: true, author: true, isbn: true } } },
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

  const loanDaysConfig = await prisma.config.findUnique({ where: { key: 'LOAN_DAYS' } });
  const loanDays = Math.min(365, Math.max(1, Math.floor(parseFloat(loanDaysConfig?.value) || 14)));

  const maxRenewConfig = await prisma.config.findUnique({ where: { key: 'MAX_RENEW_COUNT' } });
  const maxRenew = Math.min(10, Math.max(0, Math.floor(parseFloat(maxRenewConfig?.value) || 1)));

  const loan = await prisma.loan.findUnique({ where: { id } });

  if (!loan || loan.userId !== req.userId || loan.status !== 'BORROWED') {
    return res.status(404).json({ error: 'Active loan not found' });
  }

  const now = new Date();
  if (loan.dueAt < now) {
    return res.status(409).json({ error: 'Cannot renew an overdue loan. Please return the book at the desk.' });
  }
  if (maxRenew > 0 && loan.renewCount >= maxRenew) {
    return res.status(409).json({ error: `Maximum renewals (${maxRenew}) reached for this loan.` });
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

module.exports = router;
