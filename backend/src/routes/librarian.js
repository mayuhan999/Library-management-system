const express = require('express');
const { prisma } = require('../lib/prisma');
const { getLoanDays, getMaxBorrowBooks, getFineRatePerDay } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['LIBRARIAN', 'ADMIN']));

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** In-person checkout for a patron (reader) account. */
router.post('/checkout', async (req, res) => {
  const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
  const patronEmail =
    typeof req.body?.patronEmail === 'string' ? req.body.patronEmail.trim().toLowerCase() : '';

  if (!bookId || !patronEmail) {
    return res.status(400).json({ error: 'bookId and patronEmail are required' });
  }

  const patron = await prisma.user.findUnique({ where: { email: patronEmail } });
  if (!patron || !patron.isActive) {
    return res.status(404).json({ error: 'Patron not found or inactive' });
  }
  if (patron.role !== 'MEMBER') {
    return res.status(400).json({ error: 'Checkout is for reader (MEMBER) accounts only' });
  }

  const loanDays = await getLoanDays();
  const maxBooks = await getMaxBorrowBooks();

  try {
    const loan = await prisma.$transaction(async (tx) => {
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
        where: { userId: patron.id, status: 'BORROWED' },
      });
      if (activeCount >= maxBooks) {
        const err = new Error('LIMIT');
        throw err;
      }

      const existing = await tx.loan.findFirst({
        where: { userId: patron.id, bookId, status: 'BORROWED' },
      });
      if (existing) {
        const err = new Error('ALREADY_BORROWED');
        throw err;
      }

      await tx.book.update({
        where: { id: bookId },
        data: { availableCopies: { decrement: 1 } },
      });

      const created = await tx.loan.create({
        data: {
          userId: patron.id,
          bookId,
          dueAt: addDays(new Date(), loanDays),
          status: 'BORROWED',
        },
        include: {
          book: true,
          user: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.userId,
          action: 'BORROW',
          entityType: 'Loan',
          entityId: created.id,
          details: JSON.stringify({ bookId, patronId: patron.id, channel: 'DESK' }),
        },
      });

      return created;
    });

    return res.status(201).json({ loan });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (e.message === 'UNAVAILABLE') {
      return res.status(409).json({ error: 'No copies available to check out' });
    }
    if (e.message === 'ALREADY_BORROWED') {
      return res.status(409).json({ error: 'Patron already has this book on loan' });
    }
    if (e.message === 'LIMIT') {
      return res.status(409).json({
        error: `Patron has reached the maximum of ${maxBooks} active loans.`,
      });
    }
    throw e;
  }
});

/** Return a borrowed copy. Calculates overdue fine if applicable. */
router.post('/return', async (req, res) => {
  const loanId = typeof req.body?.loanId === 'string' ? req.body.loanId.trim() : '';
  if (!loanId) {
    return res.status(400).json({ error: 'loanId is required' });
  }

  const fineRate = await getFineRatePerDay();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { id: loanId, status: 'BORROWED' },
        include: { book: true },
      });
      if (!loan) {
        const err = new Error('NOT_FOUND');
        throw err;
      }

      const now = new Date();
      let fineAmount = 0;
      const isOverdue = loan.dueAt < now;

      if (isOverdue && fineRate > 0) {
        const overdueMs = now - new Date(loan.dueAt);
        const overdueDays = Math.ceil(overdueMs / (1000 * 60 * 60 * 24));
        fineAmount = parseFloat((overdueDays * fineRate).toFixed(2));
      }

      const updated = await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'RETURNED',
          returnedAt: now,
          fineAmount,
        },
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } },
          user: { select: { id: true, email: true, fullName: true } },
        },
      });

      await tx.book.update({
        where: { id: loan.bookId },
        data: { availableCopies: { increment: 1 } },
      });

      await tx.auditLog.create({
        data: {
          userId: req.userId,
          action: 'RETURN',
          entityType: 'Loan',
          entityId: loan.id,
          details: JSON.stringify({
            bookId: loan.bookId,
            isOverdue,
            overdueDays: isOverdue ? Math.ceil((now - new Date(loan.dueAt)) / (1000 * 60 * 60 * 24)) : 0,
            fineAmount,
          }),
        },
      });

      return updated;
    });

    const isOverdue = new Date(result.dueAt) < new Date();
    return res.json({
      ok: true,
      loanId: result.id,
      fineAmount: result.fineAmount,
      isOverdue,
      message: result.fineAmount > 0
        ? `Book returned. Overdue fine: $${result.fineAmount.toFixed(2)}`
        : 'Book returned successfully.',
    });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Active loan not found' });
    }
    throw e;
  }
});

/** Add a new title / copies to the catalog. */
router.post('/books', async (req, res) => {
  const b = req.body || {};
  const isbn = typeof b.isbn === 'string' ? b.isbn.trim() : '';
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const author = typeof b.author === 'string' ? b.author.trim() : '';

  if (!isbn || !title || !author) {
    return res.status(400).json({ error: 'isbn, title, and author are required' });
  }

  const totalCopies = Math.min(999, Math.max(1, parseInt(String(b.totalCopies || 1), 10) || 1));
  const availableCopies = Math.min(
    totalCopies,
    Math.max(0, parseInt(String(b.availableCopies ?? totalCopies), 10) ?? totalCopies),
  );

  const existing = await prisma.book.findUnique({ where: { isbn } });
  if (existing) {
    return res.status(409).json({ error: 'A book with this ISBN already exists' });
  }

  const book = await prisma.book.create({
    data: {
      isbn,
      title,
      author,
      publisher: typeof b.publisher === 'string' ? b.publisher.trim() || null : null,
      publishedYear:
        b.publishedYear != null && b.publishedYear !== ''
          ? parseInt(String(b.publishedYear), 10)
          : null,
      category: typeof b.category === 'string' ? b.category.trim() || null : null,
      description: typeof b.description === 'string' ? b.description.trim() || null : null,
      language: typeof b.language === 'string' ? b.language.trim() || null : null,
      shelfLocation: typeof b.shelfLocation === 'string' ? b.shelfLocation.trim() || null : null,
      totalCopies,
      availableCopies,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'CREATE',
      entityType: 'Book',
      entityId: book.id,
      details: JSON.stringify({ isbn, title }),
    },
  });

  return res.status(201).json({ book });
});

/** Active reservation queue for staff. */
router.get('/holds-queue', async (req, res) => {
  const items = await prisma.hold.findMany({
    where: { status: 'ACTIVE' },
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true, availableCopies: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: [{ placedAt: 'asc' }],
    take: 200,
  });
  res.json({ items });
});

/** Cancel / complete a hold from queue (e.g. patron picked up or cancelled). */
router.patch('/holds/:id', async (req, res) => {
  const { id } = req.params;
  const status = req.body?.status;
  if (status !== 'CANCELLED' && status !== 'FULFILLED') {
    return res.status(400).json({ error: 'status must be CANCELLED or FULFILLED' });
  }

  const hold = await prisma.hold.findFirst({ where: { id, status: 'ACTIVE' } });
  if (!hold) {
    return res.status(404).json({ error: 'Active hold not found' });
  }

  const updated = await prisma.hold.update({
    where: { id },
    data:
      status === 'CANCELLED'
        ? { status: 'CANCELLED', cancelledAt: new Date() }
        : { status: 'FULFILLED', fulfilledAt: new Date() },
    include: { book: true, user: { select: { email: true, fullName: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Hold',
      entityId: id,
      details: JSON.stringify({ newStatus: status }),
    },
  });

  res.json({ hold: updated });
});

module.exports = router;
