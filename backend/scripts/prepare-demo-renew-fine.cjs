/**
 * Demo helper: same reader keeps one NOT-overdue loan (renew); all other active loans become overdue.
 * Sets borrowedAt to a fixed date (default May 1) so timelines look consistent in class demos.
 *
 * Run: cd backend && npm run demo:renew-fine
 * Requires DATABASE_URL in backend/.env and at least 2 BORROWED loans for the reader.
 *
 * Env (optional):
 *   DEMO_STUDENT_EMAIL          default student1@library.local
 *   DEMO_BORROW_DATE            YYYY-MM-DD, default 2026-05-01 (local noon)
 *   DEMO_RENEW_DUE_DAYS         days after borrow for "renew" due date, default 14 → May 15 if borrow May 1
 *   DEMO_OVERDUE_DUE_AFTER_BORROW  days after borrow for overdue due date, default 7 → May 8 if borrow May 1
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Configure backend/.env first.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

const STUDENT_EMAIL = process.env.DEMO_STUDENT_EMAIL || 'student1@library.local';
const RENEW_DUE_AFTER = Math.max(1, parseInt(process.env.DEMO_RENEW_DUE_DAYS || '14', 10) || 14);
const OVERDUE_DUE_AFTER = Math.max(
  1,
  parseInt(process.env.DEMO_OVERDUE_DUE_AFTER_BORROW || '7', 10) || 7,
);
const BORROW_YMD = process.env.DEMO_BORROW_DATE || '2026-05-01';

function parseLocalYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) {
    throw new Error(`DEMO_BORROW_DATE must be YYYY-MM-DD, got: ${ymd}`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 12, 0, 0);
}

function addDays(base, days) {
  const x = new Date(base.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

async function main() {
  const borrowedAt = parseLocalYmd(BORROW_YMD);
  const renewDue = addDays(borrowedAt, RENEW_DUE_AFTER);
  const overdueDue = addDays(borrowedAt, OVERDUE_DUE_AFTER);
  const now = new Date();

  if (renewDue <= now) {
    console.warn(
      `[warn] Renew loan due (${renewDue.toISOString()}) is not after "now"; renew may be rejected as overdue. ` +
        'Increase DEMO_RENEW_DUE_DAYS or use an earlier DEMO_BORROW_DATE.',
    );
  }
  if (overdueDue >= now) {
    console.warn(
      `[warn] Overdue due (${overdueDue.toISOString()}) is not before "now"; rows may not show as overdue yet. ` +
        'Lower DEMO_OVERDUE_DUE_AFTER_BORROW or use an earlier DEMO_BORROW_DATE / past year.',
    );
  }

  const user = await prisma.user.findUnique({ where: { email: STUDENT_EMAIL } });
  if (!user) {
    throw new Error(`User not found: ${STUDENT_EMAIL}`);
  }

  const loans = await prisma.loan.findMany({
    where: { userId: user.id, status: 'BORROWED' },
    orderBy: [{ borrowedAt: 'asc' }, { id: 'asc' }],
    include: { book: { select: { title: true, isbn: true } } },
  });

  if (loans.length < 2) {
    throw new Error(
      `Need at least 2 active (BORROWED) loans for ${STUDENT_EMAIL}; found ${loans.length}. ` +
        'Log in as that reader and borrow another book, or run npm run seed.',
    );
  }

  const forRenew = loans[0];
  const overdueLoans = loans.slice(1);

  const ops = [
    prisma.loan.update({
      where: { id: forRenew.id },
      data: {
        borrowedAt,
        createdAt: borrowedAt,
        dueAt: renewDue,
        renewCount: 0,
      },
    }),
    ...overdueLoans.map((loan) =>
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          borrowedAt,
          createdAt: borrowedAt,
          dueAt: overdueDue,
        },
      }),
    ),
  ];

  await prisma.$transaction(ops);

  console.log('');
  console.log('Prepared demo loans for:', STUDENT_EMAIL);
  console.log('All use borrowedAt:', borrowedAt.toISOString(), `(${BORROW_YMD} local noon)`);
  console.log('');
  console.log('[1] RENEW (not overdue) — My loans → Renew');
  console.log('    Loan ID:  ', forRenew.id);
  console.log('    Book:     ', forRenew.book.title, `(${forRenew.book.isbn})`);
  console.log('    dueAt:    ', renewDue.toISOString(), `(borrow + ${RENEW_DUE_AFTER}d)`);
  console.log('    renewCount reset to 0');
  console.log('');
  console.log(`[2] OVERDUE (${overdueLoans.length} loan(s)) — renew rejected; Return → fine`);
  for (const loan of overdueLoans) {
    console.log('    Loan ID:  ', loan.id);
    console.log('    Book:     ', loan.book.title, `(${loan.book.isbn})`);
    console.log('    dueAt:    ', overdueDue.toISOString(), `(borrow + ${OVERDUE_DUE_AFTER}d)`);
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
