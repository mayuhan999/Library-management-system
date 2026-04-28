const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['MEMBER']));

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.post('/', async (req, res) => {
  const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  if (book.availableCopies > 0) {
    return res.status(400).json({
      error: 'Copies are available — borrow the book online instead of reserving.',
    });
  }

  const dup = await prisma.hold.findFirst({
    where: { userId: req.userId, bookId, status: 'ACTIVE' },
  });
  if (dup) {
    return res.status(409).json({ error: 'You already have an active reservation for this book' });
  }

  // Determine queue position (active holds placed before this one, for the same book)
  const queuePosition = await prisma.hold.count({
    where: { bookId, status: 'ACTIVE', placedAt: { lt: new Date() } },
  }) + 1;

  const hold = await prisma.hold.create({
    data: {
      userId: req.userId,
      bookId,
      status: 'ACTIVE',
      queuePosition,
      expiresAt: addDays(new Date(), 7),
    },
    include: { book: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'CREATE',
      entityType: 'Hold',
      entityId: hold.id,
      details: JSON.stringify({ bookId, kind: 'RESERVE', queuePosition }),
    },
  });

  return res.status(201).json({ hold, queuePosition });
});

module.exports = router;
