/**
 * Full acceptance demo — preserves user-added books (default: title "py").
 * Does NOT delete custom books or change catalog/copy barcodes.
 *
 * Run: cd backend && npm run demo:acceptance
 * Prerequisite: npm run seed (once)
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
  wanjian: '9787544383776',
  jsbook: '9787115581246',
};

function protectedTitlePatterns() {
  return (process.env.PROTECTED_BOOK_TITLES || 'py')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isProtectedTitle(title) {
  const t = String(title || '').trim().toLowerCase();
  return protectedTitlePatterns().some((p) => t === p || t === `《${p}》` || t.includes(p));
}

function addDays(base, days) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

async function upsertConfigs() {
  for (const row of CONFIG_DEFAULTS) {
    await prisma.config.upsert({
      where: { key: row.key },
      create: { ...row, updatedBy: 'demo:acceptance' },
      update: { description: row.description, updatedBy: 'demo:acceptance' },
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

async function loadProtectedBooks() {
  const all = await prisma.book.findMany({
    include: { copies: { select: { id: true, libraryBarcode: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return all.filter((b) => isProtectedTitle(b.title));
}

async function main() {
  const now = new Date();
  const protectedBooks = await loadProtectedBooks();

  console.log('=== Acceptance demo (custom books protected) ===\n');
  if (protectedBooks.length) {
    console.log('Protected (not deleted; barcodes unchanged):');
    for (const b of protectedBooks) {
      console.log(`  · ${b.title} | ISBN ${b.isbn}`);
      for (const c of b.copies) console.log(`      ${c.libraryBarcode} (${c.status})`);
    }
  }
  console.log('');

  const s1 = await getUser('student1@library.local');
  const s2 = await getUser('student2@library.local');
  const s3 = await getUser('student3@library.local');
  const s4 = await getUser('student4@library.local');
  const s5 = await getUser('student5@library.local');
  const librarian = await getUser('librarian@library.local');

  await upsertConfigs();

  console.log('Resetting circulation layer…');
  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { status: 'PENDING' } });
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
  let pyLoanCopy = null;

  await prisma.$transaction(async (tx) => {
    async function borrowCopy(userId, bookKey, dueAt) {
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
        },
      });
    }

    // ── student1: 在借 / 将逾期 / 逾期 / 正常 ─────────────────────────
    await borrowCopy(s1.id, 'bainian', addDays(now, 2)); // 将逾期 (REMINDER_DAYS_AHEAD=3)
    await borrowCopy(s1.id, 'zhuoyue', addDays(now, -5)); // 已逾期未还
    await borrowCopy(s1.id, 'shijian', addDays(now, 12)); // 正常在借

    // 已还 + 未付罚款 (R1.09 / 支付宝)
    const guanliCopy = await tx.bookCopy.findFirst({
      where: { bookId: books.guanli.id, status: 'AVAILABLE' },
      orderBy: { libraryBarcode: 'asc' },
    });
    if (guanliCopy) {
      await tx.bookCopy.update({ where: { id: guanliCopy.id }, data: { status: 'ON_LOAN' } });
      const loan = await tx.loan.create({
        data: {
          userId: s1.id,
          bookId: books.guanli.id,
          bookCopyId: guanliCopy.id,
          borrowedAt: addDays(now, -20),
          dueAt: addDays(now, -10),
          status: 'BORROWED',
        },
      });
      await tx.bookCopy.update({ where: { id: guanliCopy.id }, data: { status: 'AVAILABLE' } });
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

    // ── student2: 逾期在借 → Desk 还书当场罚款 ─────────────────────────
    await borrowCopy(s2.id, 'jsbook', addDays(now, -2));

    // ── 三体: 全部借出 + 排队 ─────────────────────────────────────────
    const santiCopies = await tx.bookCopy.findMany({ where: { bookId: books.santi.id } });
    const santiBorrowers = [s3, s4, s5];
    for (let i = 0; i < santiCopies.length; i += 1) {
      const copy = santiCopies[i];
      await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
      await tx.loan.create({
        data: {
          userId: santiBorrowers[i % santiBorrowers.length].id,
          bookId: books.santi.id,
          bookCopyId: copy.id,
          borrowedAt,
          dueAt: addDays(now, 7),
          status: 'BORROWED',
        },
      });
    }
    await syncBookCounters(tx, books.santi.id);

    // ── 解忧杂货店: 1 册在借 → 还书触发 L1.08 自动通知 ───────────────
    const jieyouCopies = await tx.bookCopy.findMany({
      where: { bookId: books.jieyou.id },
      orderBy: { libraryBarcode: 'asc' },
    });
    if (jieyouCopies.length >= 1) {
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

    // ── L1.07 预约：每种操作各一条（Active queue）────────────────────
    // Approve → student1 / 三体 / ACTIVE
    await tx.hold.create({
      data: {
        userId: s1.id,
        bookId: books.santi.id,
        status: 'ACTIVE',
        queuePosition: 1,
        expiresAt: addDays(now, 7),
      },
    });
    // Confirm arrival → student2 / 枪炮… / APPROVED（馆内有可借册）
    await tx.hold.create({
      data: {
        userId: s2.id,
        bookId: books.qiangpao.id,
        status: 'APPROVED',
        queuePosition: 1,
        approvedAt: addDays(now, -1),
        expiresAt: addDays(now, 7),
      },
    });
    // Picked up → student1 / 人类简史 / READY
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
    // Cancel → student3 / 万物简史 / ACTIVE
    await tx.hold.create({
      data: {
        userId: s3.id,
        bookId: books.wanjian.id,
        status: 'ACTIVE',
        queuePosition: 1,
        expiresAt: addDays(now, 7),
      },
    });

    // All orders 历史
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
        userId: s4.id,
        bookId: books.okr.id,
        status: 'CANCELLED',
        queuePosition: 1,
        placedAt: addDays(now, -20),
        cancelledAt: addDays(now, -18),
        cancelReason: '验收演示：馆员取消',
      },
    });

    // ── 活着: 库存事故 + 报表 ─────────────────────────────────────────
    const huozheCopies = await tx.bookCopy.findMany({
      where: { bookId: books.huozhe.id },
      orderBy: { libraryBarcode: 'asc' },
    });
    if (huozheCopies.length >= 3) {
      const [, cDamage, cLost] = huozheCopies;
      await tx.bookCopy.update({ where: { id: cDamage.id }, data: { status: 'DAMAGED' } });
      await tx.bookCopy.update({ where: { id: cLost.id }, data: { status: 'LOST' } });
      await tx.bookCopyIncident.create({
        data: {
          bookCopyId: cDamage.id,
          bookId: books.huozhe.id,
          type: 'DAMAGED',
          notes: '验收演示：封面水渍',
          reportedById: librarian.id,
          createdAt: addDays(now, -5),
        },
      });
      await tx.bookCopyIncident.create({
        data: {
          bookCopyId: cLost.id,
          bookId: books.huozhe.id,
          type: 'LOST',
          notes: '验收演示：读者报失',
          fineAmount: 25,
          reportedById: librarian.id,
          createdAt: addDays(now, -2),
        },
      });
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
            notes: '验收演示报失',
          },
        });
        await tx.bookCopy.update({ where: { id: cLoan.id }, data: { status: 'LOST' } });
      }
      await syncBookCounters(tx, books.huozhe.id);
    }

    // 本月已付罚款（报表）
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

    // 自定义图书 py：保持全部可借（条码不变；Desk 可用书目条码借还演示）
    for (const pb of protectedBooks) {
      await syncBookCounters(tx, pb.id);
      pyLoanCopy = {
        book: pb,
        catalogBarcode: pb.barcode || pb.isbn,
        copies: pb.copies.map((c) => c.libraryBarcode),
      };
    }
  });

  console.log('');
  console.log('=== npm run demo:acceptance 完成 ===\n');

  console.log('【借阅状态 — student1@library.local】');
  console.log('  正常在借   《时间简史》        12 天后到期');
  console.log('  将要逾期   《百年孤独》         2 天后到期 → R1.06 登录看 Messages');
  console.log('  已逾期未还 《从优秀到卓越》     逾期 5 天');
  console.log('  已还未付   《管理学原理》       罚款 ¥4.50 → Pay with Alipay');
  console.log('');
  console.log('【借阅状态 — student2@library.local】');
  console.log('  逾期在借   《JavaScript 高级程序设计》逾期 2 天 → Desk 还书产生罚款');
  console.log('');
  console.log('【预约 Reservations — Active queue 四种按钮各演示一次】');
  console.log('  Approve          student1 / 《三体》           ACTIVE');
  console.log('  Confirm arrival  student2 / 《枪炮、病菌与钢铁》 APPROVED（Copies avail. > 0）');
  console.log('  Picked up        student1 / 《人类简史》       READY');
  console.log('  Cancel           student3 / 《万物简史》       ACTIVE');
  console.log('  All orders       FULFILLED + CANCELLED 历史（《OKR 工作法》）');
  console.log('');
  console.log('【L1.08 还书自动通知】');
  console.log('  Desk 还《解忧杂货店》(student5 在借) → student2 收到 HOLD_READY');
  console.log('  （解忧预约为 ACTIVE；还书后自动升 READY 并发消息）');
  console.log('');

  if (pyLoanCopy) {
    console.log(`【py 书 — 全部可借，条码未改】`);
    console.log(`  书名: ${pyLoanCopy.book.title}`);
    console.log(`  书目条码(可扫借还): ${pyLoanCopy.catalogBarcode}`);
    console.log(`  副本条码: ${pyLoanCopy.copies.join(', ')}`);
    console.log('');
  }

  console.log('账号: student1/2/3/4/5@library.local / student123');
  console.log('      librarian@library.local / librarian123');
  console.log('      admin@library.local / admin123');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
