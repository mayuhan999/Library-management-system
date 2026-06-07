const { normalizeIsbnInput } = require('./openLibraryIsbn');

function normalizeScanCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[-\s]/g, '').trim();
}

/**
 * Resolve a scanned value to copy, book, or ISBN metadata target.
 * Priority: library copy barcode (LIB…) → book.barcode → book.isbn → bookId cuid
 */
async function resolveBarcode(client, raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return { kind: 'NOT_FOUND' };

  if (trimmed.toUpperCase().startsWith('LIB')) {
    const copy = await client.bookCopy.findFirst({
      where: { libraryBarcode: trimmed },
      include: { book: { select: { id: true, title: true, isbn: true, barcode: true } } },
    });
    if (copy) {
      return {
        kind: 'COPY',
        libraryBarcode: copy.libraryBarcode,
        bookCopyId: copy.id,
        copyStatus: copy.status,
        book: copy.book,
      };
    }

    // Catalog-level barcode (Book.barcode) — e.g. custom titles using LIB… as catalog code
    const normalizedLib = normalizeScanCode(trimmed);
    const byCatalogLib = await client.book.findFirst({
      where: { OR: [{ barcode: trimmed }, { barcode: normalizedLib }] },
      select: { id: true, title: true, isbn: true, barcode: true, availableCopies: true },
    });
    if (byCatalogLib) {
      const onLoanCopy = await client.bookCopy.findFirst({
        where: { bookId: byCatalogLib.id, status: 'ON_LOAN' },
        orderBy: { libraryBarcode: 'asc' },
      });
      if (onLoanCopy) {
        return {
          kind: 'COPY',
          libraryBarcode: onLoanCopy.libraryBarcode,
          bookCopyId: onLoanCopy.id,
          copyStatus: onLoanCopy.status,
          book: byCatalogLib,
        };
      }
      const anyCopy = await client.bookCopy.findFirst({
        where: { bookId: byCatalogLib.id },
        orderBy: { libraryBarcode: 'asc' },
      });
      return {
        kind: 'BOOK',
        bookId: byCatalogLib.id,
        book: byCatalogLib,
        libraryBarcode: anyCopy?.libraryBarcode ?? null,
        bookCopyId: anyCopy?.id ?? null,
        isbn: byCatalogLib.isbn,
      };
    }
  }

  const normalized = normalizeScanCode(trimmed);
  if (normalized) {
    const byBarcode = await client.book.findFirst({
      where: { OR: [{ barcode: normalized }, { barcode: trimmed }, { isbn: normalized }] },
      select: { id: true, title: true, isbn: true, barcode: true, availableCopies: true },
    });
    if (byBarcode) {
      const copy = await client.bookCopy.findFirst({
        where: { bookId: byBarcode.id, status: 'AVAILABLE' },
        orderBy: { libraryBarcode: 'asc' },
      });
      return {
        kind: 'BOOK',
        bookId: byBarcode.id,
        book: byBarcode,
        libraryBarcode: copy?.libraryBarcode ?? null,
        bookCopyId: copy?.id ?? null,
        isbn: byBarcode.isbn,
      };
    }
  }

  const byId = await client.book.findUnique({
    where: { id: trimmed },
    select: { id: true, title: true, isbn: true, barcode: true, availableCopies: true },
  });
  if (byId) {
    const copy = await client.bookCopy.findFirst({
      where: { bookId: byId.id, status: 'AVAILABLE' },
      orderBy: { libraryBarcode: 'asc' },
    });
    return {
      kind: 'BOOK',
      bookId: byId.id,
      book: byId,
      libraryBarcode: copy?.libraryBarcode ?? null,
      bookCopyId: copy?.id ?? null,
      isbn: byId.isbn,
    };
  }

  const isbnClean = normalizeIsbnInput(trimmed);
  if (isbnClean) {
    return { kind: 'ISBN', isbn: isbnClean, raw: trimmed };
  }

  return { kind: 'NOT_FOUND', raw: trimmed };
}

/** Prefer an AVAILABLE copy when catalog barcode matched an on-loan copy. */
async function pickAvailableCopyForBook(client, bookId) {
  return client.bookCopy.findFirst({
    where: { bookId, status: 'AVAILABLE' },
    orderBy: { libraryBarcode: 'asc' },
  });
}

/** Map scan to checkout/return body fields without altering existing param names. */
async function resolveForCheckout(client, raw) {
  let hit = await resolveBarcode(client, raw);
  if (hit.kind === 'COPY' && hit.copyStatus === 'ON_LOAN') {
    const bookId = hit.book?.id;
    if (bookId) {
      const avail = await pickAvailableCopyForBook(client, bookId);
      if (avail) {
        hit = {
          kind: 'COPY',
          libraryBarcode: avail.libraryBarcode,
          bookCopyId: avail.id,
          copyStatus: avail.status,
          book: hit.book,
        };
      }
    }
  }
  if (hit.kind === 'COPY') {
    return { libraryBarcode: hit.libraryBarcode, bookId: undefined, resolved: hit };
  }
  if (hit.kind === 'BOOK') {
    if (hit.libraryBarcode) return { libraryBarcode: hit.libraryBarcode, bookId: undefined, resolved: hit };
    return { bookId: hit.bookId, libraryBarcode: undefined, resolved: hit };
  }
  if (hit.kind === 'ISBN') {
    const book = await client.book.findFirst({ where: { isbn: hit.isbn } });
    if (book) {
      const copy = await client.bookCopy.findFirst({
        where: { bookId: book.id, status: 'AVAILABLE' },
        orderBy: { libraryBarcode: 'asc' },
      });
      if (copy) return { libraryBarcode: copy.libraryBarcode, resolved: { ...hit, kind: 'BOOK', book } };
      return { bookId: book.id, resolved: { ...hit, kind: 'BOOK', book } };
    }
    return { isbnOnly: hit.isbn, resolved: hit };
  }
  return { resolved: hit };
}

async function resolveForReturn(client, raw) {
  const hit = await resolveBarcode(client, raw);
  if (hit.kind === 'COPY' && hit.libraryBarcode) {
    return { libraryBarcode: hit.libraryBarcode, resolved: hit };
  }
  if (hit.kind === 'BOOK' && hit.bookId) {
    const activeLoan = await client.loan.findFirst({
      where: { bookId: hit.bookId, status: 'BORROWED' },
      include: { bookCopy: { select: { libraryBarcode: true } } },
      orderBy: { borrowedAt: 'desc' },
    });
    if (activeLoan?.bookCopy?.libraryBarcode) {
      return {
        libraryBarcode: activeLoan.bookCopy.libraryBarcode,
        resolved: { ...hit, kind: 'COPY', libraryBarcode: activeLoan.bookCopy.libraryBarcode },
      };
    }
  }
  if (hit.kind === 'ISBN') {
    const book = await client.book.findFirst({ where: { isbn: hit.isbn } });
    if (book) {
      const activeLoan = await client.loan.findFirst({
        where: { bookId: book.id, status: 'BORROWED' },
        include: { bookCopy: { select: { libraryBarcode: true } } },
        orderBy: { borrowedAt: 'desc' },
      });
      if (activeLoan?.bookCopy?.libraryBarcode) {
        return {
          libraryBarcode: activeLoan.bookCopy.libraryBarcode,
          resolved: { ...hit, kind: 'COPY', book },
        };
      }
    }
  }
  return { loanId: raw.trim(), resolved: hit };
}

module.exports = { normalizeScanCode, resolveBarcode, resolveForCheckout, resolveForReturn };
