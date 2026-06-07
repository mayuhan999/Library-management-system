const express = require('express');
const { prisma } = require('../lib/prisma');
const { getLoanDays, getMaxBorrowBooks } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkoutForUser } = require('../lib/loanCheckout');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['MEMBER']));

router.post('/borrow', async (req, res) => {
  const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const loanDays = await getLoanDays();
  const maxBooks = await getMaxBorrowBooks();

  try {
    const loan = await prisma.$transaction(async (tx) =>
      checkoutForUser(tx, {
        userId: req.userId,
        bookId,
        loanDays,
        maxBooks,
        auditUserId: req.userId,
        channel: 'WEB',
      }),
    );

    const { user: _u, ...loanOut } = loan;
    return res.status(201).json({ loan: loanOut });
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
    if (e.message === 'BAD_REQUEST' || e.message === 'COPY_NOT_FOUND') {
      return res.status(400).json({ error: 'Borrow request could not be completed' });
    }
    throw e;
  }
});

module.exports = router;
