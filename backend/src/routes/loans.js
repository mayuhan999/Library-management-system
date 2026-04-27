const express = require('express');
const { prisma } = require('../lib/prisma');
const { getLoanDays, getMaxBorrowBooks } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['MEMBER']));

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.post('/borrow', async (req, res) => {
  const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const loanDays = await getLoanDays();
  const maxBooks = await getMaxBorrowBooks();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const book = await tx.book.findUnique({ where: { id: bookId } });
      if (!book) {
        const err = new Error('NOT_FOUND');
        throw err;
      }
      if (book.availableCopies < 1) {
        const err = new Error('UNAVAILABLE');
        throw err;
      }

      const activeCount = await tx.loan.count({
        where: { userId: req.userId, status: 'BORROWED' },
      });
      if (activeCount >= maxBooks) {
        const err = new Error('LIMIT');
        throw err;
      }

      const existing = await tx.loan.findFirst({
        where: { userId: req.userId, bookId, status: 'BORROWED' },
      });
      if (existing) {
        const err = new Error('ALREADY_BORROWED');
        throw err;
      }

      await tx.book.update({
        where: { id: bookId },
        data: { availableCopies: { decrement: 1 } },
      });

      const loan = await tx.loan.create({
        data: {
          userId: req.userId,
          bookId,
          dueAt: addDays(new Date(), loanDays),
          status: 'BORROWED',
        },
        include: { book: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.userId,
          action: 'BORROW',
          entityType: 'Loan',
          entityId: loan.id,
          details: JSON.stringify({ bookId }),
        },
      });

      return loan;
    });

    return res.status(201).json({ loan: result });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (e.message === 'UNAVAILABLE') {
      return res.status(409).json({
        error: 'No copies available. You can place a reservation instead.',
      });
    }
    if (e.message === 'ALREADY_BORROWED') {
      return res.status(409).json({ error: 'You already have this book on loan' });
    }
    if (e.message === 'LIMIT') {
      return res.status(409).json({
        error: `You have reached the maximum of ${maxBooks} books on loan. Return one before borrowing another.`,
      });
    }
    throw e;
  }
});

module.exports = router;
