const express = require('express');
const { prisma } = require('../lib/prisma');
const { getLoanDays, getMaxBorrowBooks, getFineRatePerDay } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkoutForUser } = require('../lib/loanCheckout');
const { createUniqueBarcodes } = require('../lib/libraryBarcode');
const { lookupIsbnMetadata } = require('../lib/openLibraryIsbn');
const { syncBookCounters, promoteNextHoldForBook } = require('../lib/holdWorkflow');
const { createMessage } = require('../lib/inAppMessages');
const { resolveBarcode, resolveForCheckout, resolveForReturn, normalizeScanCode } = require('../lib/barcodeResolver');
const { getLibrarianDashboard } = require('../lib/dashboardStats');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['LIBRARIAN', 'ADMIN']));

/** L1.09 — Resolve scanned barcode (copy LIB…, book barcode, ISBN). */
router.get('/barcode-lookup', async (req, res) => {
  const code = typeof req.query?.code === 'string' ? req.query.code.trim() : '';
  if (!code) return res.status(400).json({ error: 'code is required' });

  const resolved = await resolveBarcode(prisma, code);
  if (resolved.kind === 'NOT_FOUND') {
    return res.status(404).json({ error: 'No match for this barcode', resolved });
  }
  return res.json({ resolved });
});

/** L1.11 — Librarian business dashboard. */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await getLibrarianDashboard();
    res.json(data);
  } catch (e) {
    console.error('GET /librarian/dashboard', e);
    res.status(500).json({
      error: 'Dashboard unavailable. Run: cd backend && npx prisma migrate deploy',
      detail: e.message,
    });
  }
});

/** Open Library ISBN metadata (not for generating ISBN barcodes). */
router.get('/isbn-lookup', async (req, res) => {
  try {
    const meta = await lookupIsbnMetadata(req.query?.isbn || '');
    if (!meta) {
      return res.status(404).json({ error: 'No catalog entry found for this ISBN' });
    }
    return res.json(meta);
  } catch (e) {
    if (e.message === 'INVALID_ISBN') {
      return res.status(400).json({ error: 'Invalid ISBN' });
    }
    if (e.message === 'ISBN_LOOKUP_FAILED') {
      return res.status(502).json({ error: 'ISBN lookup service unavailable' });
    }
    throw e;
  }
});

/** Copies and library barcodes for label printing. */
router.get('/books/:bookId/copies', async (req, res) => {
  const { bookId } = req.params;
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  const copies = await prisma.bookCopy.findMany({
    where: { bookId },
    orderBy: { libraryBarcode: 'asc' },
    select: { id: true, libraryBarcode: true, status: true },
  });
  return res.json({
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      barcode: book.barcode,
    },
    copies,
  });
});

/** In-person checkout for a patron (reader) account. */
router.post('/checkout', async (req, res) => {
  let bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';
  let libraryBarcode =
    typeof req.body?.libraryBarcode === 'string' ? req.body.libraryBarcode.trim() : '';
  const scanCode = typeof req.body?.barcode === 'string' ? req.body.barcode.trim() : '';
  const patronEmail =
    typeof req.body?.patronEmail === 'string' ? req.body.patronEmail.trim().toLowerCase() : '';

  if (scanCode && !bookId && !libraryBarcode) {
    const resolved = await resolveForCheckout(prisma, scanCode);
    if (resolved.isbnOnly) {
      return res.status(404).json({
        error: 'ISBN not in catalog — add the book first (Add book page)',
        isbn: resolved.isbnOnly,
      });
    }
    if (resolved.libraryBarcode) libraryBarcode = resolved.libraryBarcode;
    else if (resolved.bookId) bookId = resolved.bookId;
  }

  if (!patronEmail || (!bookId && !libraryBarcode)) {
    return res
      .status(400)
      .json({ error: 'patronEmail is required, plus either bookId or libraryBarcode' });
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
    const loan = await prisma.$transaction(async (tx) =>
      checkoutForUser(tx, {
        userId: patron.id,
        bookId: bookId || undefined,
        libraryBarcode: libraryBarcode || undefined,
        loanDays,
        maxBooks,
        auditUserId: req.userId,
        channel: 'DESK',
      }),
    );

    return res.status(201).json({ loan });
  } catch (e) {
    if (e.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (e.message === 'COPY_NOT_FOUND') {
      return res.status(404).json({ error: 'No available copy matches that library barcode' });
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
    if (e.message === 'BAD_REQUEST') {
      return res.status(400).json({ error: 'Invalid checkout request' });
    }
    throw e;
  }
});

/** Return a borrowed copy. Calculates overdue fine if applicable. */
router.post('/return', async (req, res) => {
  let loanId = typeof req.body?.loanId === 'string' ? req.body.loanId.trim() : '';
  let libraryBarcode =
    typeof req.body?.libraryBarcode === 'string' ? req.body.libraryBarcode.trim() : '';
  const scanCode = typeof req.body?.barcode === 'string' ? req.body.barcode.trim() : '';

  if (scanCode && !loanId && !libraryBarcode) {
    const resolved = await resolveForReturn(prisma, scanCode);
    if (resolved.libraryBarcode) {
      libraryBarcode = resolved.libraryBarcode;
      loanId = '';
    } else if (!resolved.libraryBarcode && resolved.resolved?.kind !== 'COPY') {
      loanId = scanCode;
    }
  }

  if (!loanId && !libraryBarcode) {
    return res.status(400).json({ error: 'loanId or libraryBarcode is required' });
  }

  const fineRate = await getFineRatePerDay();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let loan;
      if (loanId) {
        loan = await tx.loan.findFirst({
          where: { id: loanId, status: 'BORROWED' },
          include: { book: true, bookCopy: true },
        });
      } else {
        loan = await tx.loan.findFirst({
          where: {
            status: 'BORROWED',
            bookCopy: { libraryBarcode },
          },
          include: { book: true, bookCopy: true },
        });
      }
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

      if (loan.bookCopyId) {
        await tx.bookCopy.update({
          where: { id: loan.bookCopyId },
          data: { status: 'AVAILABLE' },
        });
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
            bookCopyId: loan.bookCopyId,
            libraryBarcode: loan.bookCopy?.libraryBarcode ?? null,
            isOverdue,
            overdueDays: isOverdue ? Math.ceil((now - new Date(loan.dueAt)) / (1000 * 60 * 60 * 24)) : 0,
            fineAmount,
          }),
        },
      });

      // L1.08: auto-notify next reservation when copy becomes available
      await promoteNextHoldForBook(tx, loan.bookId, req.userId);

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

  const existing = await prisma.book.findUnique({ where: { isbn } });
  if (existing) {
    return res.status(409).json({ error: 'A book with this ISBN already exists' });
  }

  const barcodeRaw = typeof b.barcode === 'string' ? b.barcode.trim() : '';
  const catalogBarcode = barcodeRaw || normalizeScanCode(isbn) || isbn;

  const coverImageUrl =
    typeof b.coverImageUrl === 'string' && b.coverImageUrl.trim()
      ? b.coverImageUrl.trim()
      : null;

  const { book, copies } = await prisma.$transaction(async (tx) => {
    const created = await tx.book.create({
      data: {
        isbn,
        barcode: catalogBarcode,
        title,
        author,
        publisher: typeof b.publisher === 'string' ? b.publisher.trim() || null : null,
      publishedYear: (() => {
        if (b.publishedYear == null || b.publishedYear === '') return null;
        const p = parseInt(String(b.publishedYear), 10);
        return Number.isFinite(p) ? p : null;
      })(),
        category: typeof b.category === 'string' ? b.category.trim() || null : null,
        description: typeof b.description === 'string' ? b.description.trim() || null : null,
        language: typeof b.language === 'string' ? b.language.trim() || null : null,
        shelfLocation: typeof b.shelfLocation === 'string' ? b.shelfLocation.trim() || null : null,
        coverImageUrl,
        totalCopies,
        availableCopies: totalCopies,
      },
    });

    const barcodes = await createUniqueBarcodes(tx, totalCopies);
    await tx.bookCopy.createMany({
      data: barcodes.map((libraryBarcode) => ({
        bookId: created.id,
        libraryBarcode,
        status: 'AVAILABLE',
      })),
    });

    const copyRows = await tx.bookCopy.findMany({
      where: { bookId: created.id },
      orderBy: { libraryBarcode: 'asc' },
      select: { id: true, libraryBarcode: true, status: true },
    });

    return { book: created, copies: copyRows };
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'CREATE',
      entityType: 'Book',
      entityId: book.id,
      details: JSON.stringify({ isbn, title, totalCopies, copyBarcodes: copies.map((c) => c.libraryBarcode) }),
    },
  });

  return res.status(201).json({ book, copies });
});

const HOLD_ACTIONS = new Set(['APPROVE', 'READY', 'FULFILL', 'CANCEL']);

/** Active reservation queue for staff (pending + ready for pickup). */
router.get('/holds-queue', async (req, res) => {
  const items = await prisma.hold.findMany({
    where: { status: { in: ['ACTIVE', 'APPROVED', 'READY'] } },
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true, availableCopies: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: [{ placedAt: 'asc' }],
    take: 200,
  });
  res.json({ items });
});

/** L1.07 — Full reservation order list with optional status filter. */
router.get('/holds', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const where = {};
  if (status) where.status = status;

  const items = await prisma.hold.findMany({
    where,
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true, availableCopies: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: { placedAt: 'desc' },
    take: 300,
  });
  res.json({ items });
});

/** L1.07 — Reservation workflow: approve, ready, fulfill, cancel. */
router.patch('/holds/:id', async (req, res) => {
  const { id } = req.params;
  const action = typeof req.body?.action === 'string' ? req.body.action.trim().toUpperCase() : '';
  const cancelReason = typeof req.body?.cancelReason === 'string' ? req.body.cancelReason.trim() : '';

  // Backward compat: legacy { status: 'CANCELLED'|'FULFILLED' }
  let resolvedAction = action;
  if (!resolvedAction && req.body?.status === 'CANCELLED') resolvedAction = 'CANCEL';
  if (!resolvedAction && req.body?.status === 'FULFILLED') resolvedAction = 'FULFILL';

  if (!HOLD_ACTIONS.has(resolvedAction)) {
    return res.status(400).json({ error: 'action must be APPROVE, READY, FULFILL, or CANCEL' });
  }

  const hold = await prisma.hold.findUnique({
    where: { id },
    include: { book: true, user: { select: { id: true, email: true, fullName: true } } },
  });
  if (!hold) return res.status(404).json({ error: 'Hold not found' });

  const now = new Date();
  let data = {};
  let notify = null;

  if (resolvedAction === 'APPROVE') {
    if (hold.status !== 'ACTIVE') {
      return res.status(409).json({ error: 'Only ACTIVE holds can be approved' });
    }
    data = { status: 'APPROVED', approvedAt: now };
  } else if (resolvedAction === 'READY') {
    if (!['ACTIVE', 'APPROVED'].includes(hold.status)) {
      return res.status(409).json({ error: 'Hold must be ACTIVE or APPROVED to mark ready' });
    }
    if (hold.book.availableCopies < 1) {
      return res.status(409).json({ error: 'No copies available — cannot confirm arrival yet' });
    }
    data = { status: 'READY', readyAt: now, ...(hold.status === 'ACTIVE' ? { approvedAt: now } : {}) };
    notify = {
      title: 'Reserved book ready for pickup',
      body: `"${hold.book.title}" is now available. Please visit the desk within 7 days.`,
    };
  } else if (resolvedAction === 'FULFILL') {
    if (!['ACTIVE', 'APPROVED', 'READY'].includes(hold.status)) {
      return res.status(409).json({ error: 'Hold is not open for pickup confirmation' });
    }
    data = {
      status: 'FULFILLED',
      fulfilledAt: now,
      ...(hold.approvedAt ? {} : { approvedAt: now }),
      ...(hold.readyAt ? {} : { readyAt: now }),
    };
  } else if (resolvedAction === 'CANCEL') {
    if (['FULFILLED', 'CANCELLED', 'EXPIRED'].includes(hold.status)) {
      return res.status(409).json({ error: 'Hold is already closed' });
    }
    data = { status: 'CANCELLED', cancelledAt: now, cancelReason: cancelReason || 'Cancelled by librarian' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.hold.update({
      where: { id },
      data,
      include: { book: true, user: { select: { email: true, fullName: true } } },
    });

    if (notify) {
      await createMessage(tx, {
        userId: hold.userId,
        type: 'HOLD_READY',
        title: notify.title,
        body: notify.body,
        relatedEntityType: 'Hold',
        relatedEntityId: hold.id,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: req.userId,
        action: resolvedAction === 'CANCEL' ? 'REJECT' : 'APPROVE',
        entityType: 'Hold',
        entityId: id,
        details: JSON.stringify({ action: resolvedAction, cancelReason: data.cancelReason || null }),
      },
    });

    return row;
  });

  res.json({ hold: updated });
});

/** L1.04 — Manual copy status update with counter sync. */
router.patch('/copies/:id', async (req, res) => {
  const { id } = req.params;
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
  const valid = ['AVAILABLE', 'ON_LOAN', 'LOST', 'DAMAGED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  const copy = await prisma.bookCopy.findUnique({ where: { id }, include: { book: true } });
  if (!copy) return res.status(404).json({ error: 'Copy not found' });

  if (status === 'ON_LOAN') {
    const activeLoan = await prisma.loan.findFirst({
      where: { bookCopyId: id, status: 'BORROWED' },
    });
    if (!activeLoan) {
      return res.status(409).json({ error: 'Cannot set ON_LOAN without an active loan on this copy' });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.bookCopy.update({ where: { id }, data: { status } });
    await syncBookCounters(tx, copy.bookId);

    if (status === 'AVAILABLE' && copy.status !== 'AVAILABLE') {
      await promoteNextHoldForBook(tx, copy.bookId, req.userId);
    }

    await tx.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entityType: 'BookCopy',
        entityId: id,
        details: JSON.stringify({ from: copy.status, to: status, bookId: copy.bookId }),
      },
    });

    return row;
  });

  res.json({ copy: updated });
});

/** L1.05 — Record lost/damaged copy and archive incident. */
router.post('/copies/:id/incident', async (req, res) => {
  const { id } = req.params;
  const type = typeof req.body?.type === 'string' ? req.body.type.trim().toUpperCase() : '';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  const fineAmount = parseFloat(String(req.body?.fineAmount ?? '0')) || 0;

  if (type !== 'LOST' && type !== 'DAMAGED') {
    return res.status(400).json({ error: 'type must be LOST or DAMAGED' });
  }

  const copy = await prisma.bookCopy.findUnique({ where: { id } });
  if (!copy) return res.status(404).json({ error: 'Copy not found' });

  const copyStatus = type === 'LOST' ? 'LOST' : 'DAMAGED';

  const result = await prisma.$transaction(async (tx) => {
    const activeLoan = await tx.loan.findFirst({
      where: { bookCopyId: id, status: 'BORROWED' },
      include: { user: { select: { id: true, email: true } } },
    });

    if (activeLoan) {
      await tx.loan.update({
        where: { id: activeLoan.id },
        data: {
          status: 'LOST',
          returnedAt: new Date(),
          fineAmount: fineAmount > 0 ? fineAmount : activeLoan.fineAmount,
          finePaid: false,
          notes: notes || activeLoan.notes,
        },
      });
    }

    await tx.bookCopy.update({ where: { id }, data: { status: copyStatus } });

    const incident = await tx.bookCopyIncident.create({
      data: {
        bookCopyId: id,
        bookId: copy.bookId,
        type,
        notes: notes || null,
        fineAmount: fineAmount > 0 ? fineAmount : 0,
        reportedById: req.userId,
      },
    });

    await syncBookCounters(tx, copy.bookId);

    await tx.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entityType: 'BookCopyIncident',
        entityId: incident.id,
        details: JSON.stringify({
          type,
          bookCopyId: id,
          bookId: copy.bookId,
          loanId: activeLoan?.id ?? null,
          fineAmount: incident.fineAmount,
        }),
      },
    });

    return { incident, loan: activeLoan };
  });

  res.status(201).json(result);
});

/** L1.06 — Monthly lost/damaged/overdue report (JSON or CSV). */
router.get('/reports/monthly', async (req, res) => {
  const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
  const month = parseInt(String(req.query.month || new Date().getMonth() + 1), 10);
  const format = typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : 'json';

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Valid year and month (1-12) are required' });
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [incidents, overdueLoans, lostLoans] = await Promise.all([
    prisma.bookCopyIncident.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: {
        bookCopy: { select: { libraryBarcode: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.loan.findMany({
      where: {
        returnedAt: { gte: start, lt: end },
        fineAmount: { gt: 0 },
      },
      include: {
        book: { select: { title: true, isbn: true } },
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { returnedAt: 'asc' },
    }),
    prisma.loan.findMany({
      where: {
        status: 'LOST',
        updatedAt: { gte: start, lt: end },
      },
      include: {
        book: { select: { title: true, isbn: true } },
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
  ]);

  const bookIds = [...new Set(incidents.map((i) => i.bookId))];
  const books = bookIds.length
    ? await prisma.book.findMany({
        where: { id: { in: bookIds } },
        select: { id: true, title: true, isbn: true },
      })
    : [];
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));

  const report = {
    period: { year, month, start: start.toISOString(), end: end.toISOString() },
    summary: {
      incidents: incidents.length,
      overdueReturns: overdueLoans.length,
      lostLoans: lostLoans.length,
      totalFines: parseFloat(
        overdueLoans.reduce((s, l) => s + l.fineAmount, 0).toFixed(2),
      ),
    },
    incidents: incidents.map((i) => ({
      date: i.createdAt,
      type: i.type,
      barcode: i.bookCopy.libraryBarcode,
      bookTitle: bookMap[i.bookId]?.title,
      isbn: bookMap[i.bookId]?.isbn,
      notes: i.notes,
      fineAmount: i.fineAmount,
    })),
    overdueReturns: overdueLoans.map((l) => ({
      returnedAt: l.returnedAt,
      patron: l.user.fullName,
      email: l.user.email,
      book: l.book.title,
      isbn: l.book.isbn,
      fineAmount: l.fineAmount,
      finePaid: l.finePaid,
    })),
    lostLoans: lostLoans.map((l) => ({
      date: l.updatedAt,
      patron: l.user.fullName,
      email: l.user.email,
      book: l.book.title,
      isbn: l.book.isbn,
      fineAmount: l.fineAmount,
    })),
  };

  if (format === 'csv') {
    const lines = [
      'Section,Date,Type,Patron,Email,Book,ISBN,Barcode,Notes,FineAmount,FinePaid',
    ];

    for (const i of report.incidents) {
      lines.push(
        [
          'incident',
          new Date(i.date).toISOString(),
          i.type,
          '',
          '',
          `"${(i.bookTitle || '').replace(/"/g, '""')}"`,
          i.isbn || '',
          i.barcode || '',
          `"${(i.notes || '').replace(/"/g, '""')}"`,
          i.fineAmount,
          '',
        ].join(','),
      );
    }
    for (const l of report.overdueReturns) {
      lines.push(
        [
          'overdue',
          new Date(l.returnedAt).toISOString(),
          'OVERDUE',
          `"${l.patron.replace(/"/g, '""')}"`,
          l.email,
          `"${l.book.replace(/"/g, '""')}"`,
          l.isbn,
          '',
          '',
          l.fineAmount,
          l.finePaid ? 'yes' : 'no',
        ].join(','),
      );
    }
    for (const l of report.lostLoans) {
      lines.push(
        [
          'lost_loan',
          new Date(l.date).toISOString(),
          'LOST',
          `"${l.patron.replace(/"/g, '""')}"`,
          l.email,
          `"${l.book.replace(/"/g, '""')}"`,
          l.isbn,
          '',
          '',
          l.fineAmount,
          '',
        ].join(','),
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="library-report-${year}-${String(month).padStart(2, '0')}.csv"`,
    );
    return res.send(lines.join('\n'));
  }

  res.json(report);
});

module.exports = router;
