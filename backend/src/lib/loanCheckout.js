function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function resolveLegacyOrCopy(tx, bookId) {
  const hasRows = await tx.bookCopy.count({ where: { bookId } });
  if (hasRows === 0) {
    return { mode: 'legacy', copy: null };
  }
  const copy = await tx.bookCopy.findFirst({
    where: { bookId, status: 'AVAILABLE' },
    orderBy: { libraryBarcode: 'asc' },
  });
  return { mode: 'copy', copy };
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} [opts.bookId]
 * @param {string} [opts.libraryBarcode]
 * @param {string} [opts.bookCopyId]
 * @param {number} opts.loanDays
 * @param {number} opts.maxBooks
 * @param {string} [opts.auditUserId]
 * @param {string} [opts.channel]
 */
async function checkoutForUser(tx, opts) {
  const {
    userId,
    bookId: initialBookId,
    libraryBarcode,
    bookCopyId,
    loanDays,
    maxBooks,
    auditUserId,
    channel,
  } = opts;

  let bookId = typeof initialBookId === 'string' ? initialBookId.trim() : '';
  let copy = null;

  if (libraryBarcode && String(libraryBarcode).trim()) {
    const b = String(libraryBarcode).trim();
    copy = await tx.bookCopy.findFirst({
      where: { libraryBarcode: b, status: 'AVAILABLE' },
    });
    if (!copy) {
      const err = new Error('COPY_NOT_FOUND');
      throw err;
    }
    bookId = copy.bookId;
  } else if (bookCopyId && String(bookCopyId).trim()) {
    copy = await tx.bookCopy.findFirst({
      where: { id: String(bookCopyId).trim(), status: 'AVAILABLE' },
    });
    if (!copy) {
      const err = new Error('COPY_NOT_FOUND');
      throw err;
    }
    bookId = copy.bookId;
  } else if (bookId) {
    const { mode, copy: c } = await resolveLegacyOrCopy(tx, bookId);
    if (mode === 'legacy') {
      copy = null;
    } else {
      copy = c;
      if (!copy) {
        const err = new Error('UNAVAILABLE');
        throw err;
      }
    }
  } else {
    const err = new Error('BAD_REQUEST');
    throw err;
  }

  const book = await tx.book.findUnique({ where: { id: bookId } });
  if (!book) {
    const err = new Error('NOT_FOUND');
    throw err;
  }

  if (!copy && book.availableCopies < 1) {
    const err = new Error('UNAVAILABLE');
    throw err;
  }

  const activeCount = await tx.loan.count({
    where: { userId, status: 'BORROWED' },
  });
  if (activeCount >= maxBooks) {
    const err = new Error('LIMIT');
    throw err;
  }

  const existing = await tx.loan.findFirst({
    where: { userId, bookId, status: 'BORROWED' },
  });
  if (existing) {
    const err = new Error('ALREADY_BORROWED');
    throw err;
  }

  if (copy) {
    await tx.bookCopy.update({
      where: { id: copy.id },
      data: { status: 'ON_LOAN' },
    });
  }

  await tx.book.update({
    where: { id: bookId },
    data: { availableCopies: { decrement: 1 } },
  });

  const loan = await tx.loan.create({
    data: {
      userId,
      bookId,
      bookCopyId: copy ? copy.id : null,
      dueAt: addDays(new Date(), loanDays),
      status: 'BORROWED',
    },
    include: {
      book: true,
      bookCopy: true,
      user: {
        select: { id: true, email: true, fullName: true, role: true },
      },
    },
  });

  await tx.auditLog.create({
    data: {
      userId: auditUserId ?? userId,
      action: 'BORROW',
      entityType: 'Loan',
      entityId: loan.id,
      details: JSON.stringify({
        bookId,
        bookCopyId: copy?.id ?? null,
        libraryBarcode: copy?.libraryBarcode ?? null,
        channel: channel || 'WEB',
      }),
    },
  });

  return loan;
}

module.exports = {
  addDays,
  checkoutForUser,
};
