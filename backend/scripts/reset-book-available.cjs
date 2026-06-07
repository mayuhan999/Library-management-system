/**
 * Return all active loans and set copies AVAILABLE for protected/custom books (default: title "py").
 * Does not change catalog or copy barcodes.
 *
 * Run: npm run books:available
 * Or:  BOOK_BARCODE=LIB5E2ACE3E1574 npm run books:available
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

function protectedTitlePatterns() {
  return (process.env.PROTECTED_BOOK_TITLES || 'py')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function findTargetBooks() {
  const barcode = (process.env.BOOK_BARCODE || '').trim();
  if (barcode) {
    const book = await prisma.book.findFirst({
      where: { OR: [{ barcode }, { isbn: barcode }] },
      include: { copies: true },
    });
    return book ? [book] : [];
  }

  const all = await prisma.book.findMany({ include: { copies: true } });
  const patterns = protectedTitlePatterns();
  return all.filter((b) => {
    const t = (b.title || '').trim().toLowerCase();
    return patterns.some((p) => t === p || t === `《${p}》` || t.includes(p));
  });
}

async function syncBookCounters(tx, bookId) {
  const copies = await tx.bookCopy.findMany({ where: { bookId } });
  const availableCopies = copies.filter((c) => c.status === 'AVAILABLE').length;
  await tx.book.update({
    where: { id: bookId },
    data: { totalCopies: copies.length, availableCopies },
  });
}

async function main() {
  const books = await findTargetBooks();
  if (!books.length) {
    console.error('No matching book. Set BOOK_BARCODE=… or PROTECTED_BOOK_TITLES=py');
    process.exit(1);
  }

  for (const book of books) {
    await prisma.$transaction(async (tx) => {
      const loans = await tx.loan.findMany({
        where: { bookId: book.id, status: 'BORROWED' },
      });
      for (const loan of loans) {
        if (loan.bookCopyId) {
          await tx.bookCopy.update({
            where: { id: loan.bookCopyId },
            data: { status: 'AVAILABLE' },
          });
        }
        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'RETURNED', returnedAt: new Date() },
        });
      }
      await tx.bookCopy.updateMany({
        where: { bookId: book.id },
        data: { status: 'AVAILABLE' },
      });
      await syncBookCounters(tx, book.id);
    });

    const refreshed = await prisma.book.findUnique({
      where: { id: book.id },
      include: { copies: { orderBy: { libraryBarcode: 'asc' } } },
    });
    console.log(`OK: ${refreshed.title}`);
    console.log(`  catalog barcode: ${refreshed.barcode || refreshed.isbn}`);
    console.log(`  available: ${refreshed.availableCopies}/${refreshed.totalCopies}`);
    for (const c of refreshed.copies) {
      console.log(`  copy ${c.libraryBarcode} → ${c.status}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
