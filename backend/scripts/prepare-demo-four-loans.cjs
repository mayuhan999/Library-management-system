/**
 * Demo: exactly 4 active loans for one reader — 3 renewable (not overdue), 1 overdue.
 * Sets system MAX_RENEW_COUNT to 3 (each loan may renew up to 3 times).
 *
 * If the reader has more than 4 BORROWED loans, extra ones are closed as returned (copy back on shelf).
 * If fewer than 4, exits with an error (borrow more or re-seed).
 *
 * Run: cd backend && npm run demo:four-loans
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

const STUDENT_EMAIL = process.env.DEMO_STUDENT_EMAIL || 'student1@library.local';
const TARGET_ACTIVE = 4;
const RENEWABLE_COUNT = 3;
const MAX_RENEW_VALUE = '3';

const BORROW_YMD = process.env.DEMO_BORROW_DATE || '2026-05-01';
const RENEW_DUE_AFTER = Math.max(1, parseInt(process.env.DEMO_RENEW_DUE_DAYS || '14', 10) || 14);
const OVERDUE_DUE_AFTER = Math.max(
  1,
  parseInt(process.env.DEMO_OVERDUE_DUE_AFTER_BORROW || '7', 10) || 7,
);

function parseLocalYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) throw new Error(`DEMO_BORROW_DATE must be YYYY-MM-DD, got: ${ymd}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function addDays(base, days) {
  const x = new Date(base.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

async function returnLoanQuiet(tx, loanId) {
  const loan = await tx.loan.findFirst({
    where: { id: loanId, status: 'BORROWED' },
  });
  if (!loan) return;
  if (loan.bookCopyId) {
    await tx.bookCopy.update({
      where: { id: loan.bookCopyId },
      data: { status: 'AVAILABLE' },
    });
  }
  await tx.book.update({
    where: { id: loan.bookId },
    data: { availableCopies: { increment: 1 } },
  });
  await tx.loan.update({
    where: { id: loan.id },
    data: {
      status: 'RETURNED',
      returnedAt: new Date(),
      fineAmount: 0,
    },
  });
}

async function main() {
  const borrowedAt = parseLocalYmd(BORROW_YMD);
  const renewDue = addDays(borrowedAt, RENEW_DUE_AFTER);
  const overdueDue = addDays(borrowedAt, OVERDUE_DUE_AFTER);

  const user = await prisma.user.findUnique({ where: { email: STUDENT_EMAIL } });
  if (!user) throw new Error(`User not found: ${STUDENT_EMAIL}`);

  let loans = await prisma.loan.findMany({
    where: { userId: user.id, status: 'BORROWED' },
    orderBy: [{ borrowedAt: 'asc' }, { id: 'asc' }],
    include: { book: { select: { title: true, isbn: true } } },
  });

  if (loans.length < TARGET_ACTIVE) {
    throw new Error(
      `Need at least ${TARGET_ACTIVE} BORROWED loans for ${STUDENT_EMAIL}; found ${loans.length}. ` +
        'Borrow more books or run npm run seed.',
    );
  }

  if (loans.length > TARGET_ACTIVE) {
    const drop = loans.slice(TARGET_ACTIVE);
    await prisma.$transaction(async (tx) => {
      for (const l of drop) {
        await returnLoanQuiet(tx, l.id);
      }
    });
    loans = loans.slice(0, TARGET_ACTIVE);
    console.log(`Returned ${drop.length} extra loan(s) so only ${TARGET_ACTIVE} stay active.\n`);
  }

  await prisma.config.upsert({
    where: { key: 'MAX_RENEW_COUNT' },
    create: {
      key: 'MAX_RENEW_COUNT',
      value: MAX_RENEW_VALUE,
      description: 'Maximum renewals per loan (demo script).',
      updatedBy: 'demo:four-loans',
    },
    update: {
      value: MAX_RENEW_VALUE,
      updatedBy: 'demo:four-loans',
    },
  });

  const updates = [];
  for (let i = 0; i < RENEWABLE_COUNT; i += 1) {
    updates.push(
      prisma.loan.update({
        where: { id: loans[i].id },
        data: {
          borrowedAt,
          createdAt: borrowedAt,
          dueAt: renewDue,
          renewCount: 0,
        },
      }),
    );
  }
  updates.push(
    prisma.loan.update({
      where: { id: loans[3].id },
      data: {
        borrowedAt,
        createdAt: borrowedAt,
        dueAt: overdueDue,
      },
    }),
  );

  await prisma.$transaction(updates);

  console.log('MAX_RENEW_COUNT set to', MAX_RENEW_VALUE, '(per loan).');
  console.log('If Renew says "Maximum renewals reached", run this script again to reset renewCount on the 3 renewable rows.');
  console.log('');
  console.log(`Borrowed date (all 4): ${BORROW_YMD} local noon`);
  console.log('');
  console.log(`Renewable (×${RENEWABLE_COUNT}) — due ${renewDue.toISOString().slice(0, 10)}`);
  for (let i = 0; i < RENEWABLE_COUNT; i += 1) {
    const L = loans[i];
    console.log(`  ${i + 1}. ${L.book.title} | loan ${L.id}`);
  }
  console.log('');
  console.log(`Overdue (×1) — due ${overdueDue.toISOString().slice(0, 10)}`);
  console.log(`  ${loans[3].book.title} | loan ${loans[3].id}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
