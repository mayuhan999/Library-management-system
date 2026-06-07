/**
 * One-time helper after adding BookCopy: creates rows for existing books
 * and links active loans without bookCopyId. Then resyncs Book.availableCopies.
 *
 * Usage (from backend/): node prisma/backfill-book-copies.cjs
 */
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { createUniqueBarcodes } = require('../src/lib/libraryBarcode');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (e.g. file:./prisma/dev.db in backend/.env)');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

async function main() {
  const books = await prisma.book.findMany();
  for (const book of books) {
    const existing = await prisma.bookCopy.count({ where: { bookId: book.id } });
    if (existing >= book.totalCopies) continue;
    const need = book.totalCopies - existing;
    const barcodes = await createUniqueBarcodes(prisma, need);
    await prisma.bookCopy.createMany({
      data: barcodes.map((libraryBarcode) => ({
        bookId: book.id,
        libraryBarcode,
        status: 'AVAILABLE',
      })),
    });
  }

  const borrowedLoans = await prisma.loan.findMany({
    where: { status: 'BORROWED', bookCopyId: null },
  });

  for (const loan of borrowedLoans) {
    const copy = await prisma.bookCopy.findFirst({
      where: { bookId: loan.bookId, status: 'AVAILABLE' },
      orderBy: { libraryBarcode: 'asc' },
    });
    if (!copy) {
      console.warn('No available copy to attach for loan', loan.id);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
      await tx.loan.update({ where: { id: loan.id }, data: { bookCopyId: copy.id } });
    });
  }

  for (const book of await prisma.book.findMany()) {
    const avail = await prisma.bookCopy.count({
      where: { bookId: book.id, status: 'AVAILABLE' },
    });
    await prisma.book.update({
      where: { id: book.id },
      data: { availableCopies: avail },
    });
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
