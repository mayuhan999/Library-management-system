/**
 * R3 acceptance demo data — safe to run repeatedly.
 * Resets circulation/messages/holds/incidents, then seeds a deterministic scenario
 * using relative dates from "now" so every R3 story can be tested multiple times.
 *
 * Run: cd backend && npm run demo:r3
 * Prerequisite: npm run seed (users + catalog)
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { CONFIG_DEFAULTS } = require('../src/lib/configDefaults');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }),
});

const ISBN = {
  santi: '9787544291170',
  jieyou: '9787530210291',
  huozhe: '9787020002207',
  bainian: '9787020139873',
  zhuoyue: '9787508684035',
  guanli: '9787111561273',
  renlei: '9787508698643',
  qiangpao: '9787020152407',
  shijian: '9787544270878',
  okr: '9787508680907',
};

function addDays(base, days) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(base, hours) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

async function upsertConfigs() {
  for (const row of CONFIG_DEFAULTS) {
    await prisma.config.upsert({
      where: { key: row.key },
      create: { ...row, updatedBy: 'demo:r3' },
      update: { description: row.description, updatedBy: 'demo:r3' },
    });
  }
}

async function syncBookCounters(tx, bookId) {
  const copies = await tx.bookCopy.findMany({ where: { bookId } });
  if (!copies.length) return;
  const availableCopies = copies.filter((c) => c.status === 'AVAILABLE').length;
  await tx.book.update({
    where: { id: bookId },
    data: { totalCopies: copies.length, availableCopies },
  });
}

async function syncAllBooks(tx) {
  const books = await tx.book.findMany({ select: { id: true } });
  for (const b of books) {
    await syncBookCounters(tx, b.id);
  }
}

async function returnAllActiveLoans(tx) {
  const loans = await tx.loan.findMany({ where: { status: 'BORROWED' } });
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
}

async function getUser(email) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`User missing: ${email}. Run npm run seed first.`);
  return u;
}

async function getBook(isbn) {
  const b = await prisma.book.findUnique({ where: { isbn } });
  if (!b) throw new Error(`Book missing ISBN ${isbn}. Run npm run seed first.`);
  return b;
}

async function getCopies(bookId) {
  return prisma.bookCopy.findMany({
    where: { bookId },
    orderBy: { libraryBarcode: 'asc' },
  });
}

async function main() {
  const now = new Date();
  const s1 = await getUser('student1@library.local');
  const s2 = await getUser('student2@library.local');
  const s3 = await getUser('student3@library.local');
  const s4 = await getUser('student4@library.local');
  const s5 = await getUser('student5@library.local');
  const librarian = await getUser('librarian@library.local');

  console.log('Upserting R3 config keys (incl. REMINDER_DAYS_AHEAD)…');
  await upsertConfigs();

  console.log('Resetting R3 demo circulation data…');
  await prisma.$transaction(async (tx) => {
    await tx.inAppMessage.deleteMany();
    await tx.bookCopyIncident.deleteMany();
    await tx.hold.deleteMany();
    await returnAllActiveLoans(tx);
    await tx.bookCopy.updateMany({ data: { status: 'AVAILABLE' } });
    await syncAllBooks(tx);
  });

  const books = {};
  for (const [name, isbn] of Object.entries(ISBN)) {
    books[name] = await getBook(isbn);
  }

  const borrowedAt = addDays(now, -10);

  await prisma.$transaction(async (tx) => {
    // --- student1: R1.06 / R1.08 loans ---
    async function borrowCopy(userId, bookKey, dueAt, extra = {}) {
      const book = books[bookKey];
      const copy = await tx.bookCopy.findFirst({
        where: { bookId: book.id, status: 'AVAILABLE' },
        orderBy: { libraryBarcode: 'asc' },
      });
      if (!copy) throw new Error(`No AVAILABLE copy for ${book.title}`);
      await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
      await syncBookCounters(tx, book.id);
      return tx.loan.create({
        data: {
          userId,
          bookId: book.id,
          bookCopyId: copy.id,
          borrowedAt,
          dueAt,
          status: 'BORROWED',
          ...extra,
        },
      });
    }

    // Due in 2 days → DUE_SOON + reminder (N=3)
    await borrowCopy(s1.id, 'bainian', addDays(now, 2));
    // 5 days overdue → OVERDUE reminder
    await borrowCopy(s1.id, 'zhuoyue', addDays(now, -5));
    // Due in 12 days → normal on-loan
    await borrowCopy(s1.id, 'shijian', addDays(now, 12));

    // Unpaid fine (returned)
    const guanliCopies = await tx.bookCopy.findMany({
      where: { bookId: books.guanli.id, status: 'AVAILABLE' },
      take: 1,
    });
    if (guanliCopies[0]) {
      const c = guanliCopies[0];
      await tx.bookCopy.update({ where: { id: c.id }, data: { status: 'ON_LOAN' } });
      await syncBookCounters(tx, books.guanli.id);
      const loan = await tx.loan.create({
        data: {
          userId: s1.id,
          bookId: books.guanli.id,
          bookCopyId: c.id,
          borrowedAt: addDays(now, -20),
          dueAt: addDays(now, -10),
          status: 'BORROWED',
        },
      });
      await tx.bookCopy.update({ where: { id: c.id }, data: { status: 'AVAILABLE' } });
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'RETURNED',
          returnedAt: addDays(now, -3),
          fineAmount: 4.5,
          finePaid: false,
        },
      });
      await syncBookCounters(tx, books.guanli.id);
    }

    // --- 三体: all copies on loan → holds queue (L1.07 / L1.08) ---
    const santiCopies = await tx.bookCopy.findMany({ where: { bookId: books.santi.id } });
    const santiBorrowers = [s3, s4, s5];
    for (let i = 0; i < santiCopies.length; i += 1) {
      const copy = santiCopies[i];
      const user = santiBorrowers[i % santiBorrowers.length];
      await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
      await tx.loan.create({
        data: {
          userId: user.id,
          bookId: books.santi.id,
          bookCopyId: copy.id,
          borrowedAt,
          dueAt: addDays(now, 7),
          status: 'BORROWED',
        },
      });
    }
    await syncBookCounters(tx, books.santi.id);

    await tx.hold.create({
      data: {
        userId: s1.id,
        bookId: books.santi.id,
        status: 'ACTIVE',
        queuePosition: 1,
        expiresAt: addDays(now, 7),
      },
    });
    await tx.hold.create({
      data: {
        userId: s2.id,
        bookId: books.santi.id,
        status: 'APPROVED',
        queuePosition: 2,
        approvedAt: addDays(now, -1),
        expiresAt: addDays(now, 7),
      },
    });

    // --- 解忧杂货店: 1 on loan, 1 available — return triggers L1.08 for s2 ---
    const jieyouCopies = await tx.bookCopy.findMany({ where: { bookId: books.jieyou.id } });
    if (jieyouCopies.length >= 2) {
      await tx.bookCopy.update({ where: { id: jieyouCopies[0].id }, data: { status: 'ON_LOAN' } });
      await tx.loan.create({
        data: {
          userId: s5.id,
          bookId: books.jieyou.id,
          bookCopyId: jieyouCopies[0].id,
          borrowedAt,
          dueAt: addDays(now, 5),
          status: 'BORROWED',
        },
      });
      await syncBookCounters(tx, books.jieyou.id);
      await tx.hold.create({
        data: {
          userId: s2.id,
          bookId: books.jieyou.id,
          status: 'ACTIVE',
          queuePosition: 1,
          expiresAt: addDays(now, 7),
        },
      });
    }

    // --- 人类简史: READY hold (pickup demo) ---
    const renleiCopies = await tx.bookCopy.findMany({ where: { bookId: books.renlei.id } });
    if (renleiCopies.length > 0) {
      await tx.hold.create({
        data: {
          userId: s1.id,
          bookId: books.renlei.id,
          status: 'READY',
          queuePosition: 1,
          approvedAt: addDays(now, -2),
          readyAt: addDays(now, -1),
          expiresAt: addDays(now, 5),
        },
      });
    }

    // --- 枪炮病菌与钢铁: APPROVED hold (librarian approve flow already done) ---
    await tx.hold.create({
      data: {
        userId: s1.id,
        bookId: books.qiangpao.id,
        status: 'APPROVED',
        queuePosition: 1,
        approvedAt: addHours(now, -6),
        expiresAt: addDays(now, 7),
      },
    });

    // Historical holds for "All orders"
    await tx.hold.create({
      data: {
        userId: s1.id,
        bookId: books.okr.id,
        status: 'FULFILLED',
        queuePosition: 1,
        placedAt: addDays(now, -30),
        fulfilledAt: addDays(now, -25),
      },
    });
    await tx.hold.create({
      data: {
        userId: s2.id,
        bookId: books.okr.id,
        status: 'CANCELLED',
        queuePosition: 1,
        placedAt: addDays(now, -20),
        cancelledAt: addDays(now, -18),
        cancelReason: 'Demo cancelled order',
      },
    });

    // --- 活着: L1.04 / L1.05 / L1.06 inventory & incidents ---
    const huozheCopies = await tx.bookCopy.findMany({ where: { bookId: books.huozhe.id } });
    if (huozheCopies.length >= 3) {
      const [cAvail, cDamage, cLost] = huozheCopies;
      await tx.bookCopy.update({ where: { id: cDamage.id }, data: { status: 'DAMAGED' } });
      await tx.bookCopy.update({ where: { id: cLost.id }, data: { status: 'LOST' } });
      await tx.bookCopyIncident.create({
        data: {
          bookCopyId: cDamage.id,
          bookId: books.huozhe.id,
          type: 'DAMAGED',
          notes: 'Demo: water damage on cover',
          reportedById: librarian.id,
          createdAt: addDays(now, -5),
        },
      });
      await tx.bookCopyIncident.create({
        data: {
          bookCopyId: cLost.id,
          bookId: books.huozhe.id,
          type: 'LOST',
          notes: 'Demo: reported lost by patron',
          fineAmount: 25,
          reportedById: librarian.id,
          createdAt: addDays(now, -2),
        },
      });
      // Lost loan for monthly report
      if (huozheCopies.length >= 4) {
        const cLoan = huozheCopies[3];
        await tx.bookCopy.update({ where: { id: cLoan.id }, data: { status: 'ON_LOAN' } });
        const lostLoan = await tx.loan.create({
          data: {
            userId: s4.id,
            bookId: books.huozhe.id,
            bookCopyId: cLoan.id,
            borrowedAt: addDays(now, -40),
            dueAt: addDays(now, -20),
            status: 'BORROWED',
          },
        });
        await tx.loan.update({
          where: { id: lostLoan.id },
          data: {
            status: 'LOST',
            returnedAt: addDays(now, -1),
            fineAmount: 15,
            finePaid: false,
            notes: 'Demo lost book',
          },
        });
        await tx.bookCopy.update({ where: { id: cLoan.id }, data: { status: 'LOST' } });
      }
      await syncBookCounters(tx, books.huozhe.id);
    }

    // Overdue return with fine this month (L1.06 report)
    const okrCopy = await tx.bookCopy.findFirst({
      where: { bookId: books.okr.id, status: 'AVAILABLE' },
    });
    if (okrCopy) {
      await tx.bookCopy.update({ where: { id: okrCopy.id }, data: { status: 'ON_LOAN' } });
      const temp = await tx.loan.create({
        data: {
          userId: s2.id,
          bookId: books.okr.id,
          bookCopyId: okrCopy.id,
          borrowedAt: addDays(now, -18),
          dueAt: addDays(now, -8),
          status: 'BORROWED',
        },
      });
      await tx.bookCopy.update({ where: { id: okrCopy.id }, data: { status: 'AVAILABLE' } });
      await tx.loan.update({
        where: { id: temp.id },
        data: {
          status: 'RETURNED',
          returnedAt: addDays(now, -4),
          fineAmount: 2.0,
          finePaid: true,
        },
      });
      await syncBookCounters(tx, books.okr.id);
    }
  });

  console.log('');
  console.log('=== R3 demo data ready (re-run anytime: npm run demo:r3) ===');
  console.log('');
  console.log('Accounts: student1@library.local / student123 (primary)');
  console.log('          student2@library.local / student123 (L1.08 hold queue)');
  console.log('          librarian@library.local / librarian123');
  console.log('          admin@library.local / admin123');
  console.log('');
  console.log('R1.06 Due reminder → student1 login → Status center → Messages');
  console.log('  · 百年孤独: due in 2 days (Loan due soon)');
  console.log('  · 从优秀到卓越: 5 days overdue (Loan overdue)');
  console.log('');
  console.log('R1.08 Status center → student1 → Status center');
  console.log('  · 3 on loan, 1 unpaid fine ($4.50), holds + reservations');
  console.log('');
  console.log('L1.07 Reservations → librarian → Reservations');
  console.log('  · 三体: ACTIVE (s1) + APPROVED (s2); 人类简史: READY (s1)');
  console.log('  · All orders: FULFILLED + CANCELLED history');
  console.log('');
  console.log('L1.08 Auto notify → librarian Desk → return 解忧杂货店 copy (s5 loan)');
  console.log('  · Then student2 Status center sees HOLD_READY message');
  console.log('');
  console.log('L1.04/L1.05 Inventory → librarian → Inventory → 活着 → Copies');
  console.log('  · DAMAGED + LOST copies with incident archive');
  console.log('');
  console.log('L1.06 Reports → librarian → Reports → current month → Export CSV');
  console.log('');
  console.log('A1.09 Backup → admin → Loan rules (REMINDER_DAYS_AHEAD now visible)');
  console.log('  · System & database → Create backup now');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
