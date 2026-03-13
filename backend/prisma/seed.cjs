const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

dotenv.config();

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const userSeeds = [
  {
    email: "admin@library.local",
    passwordHash: "admin123-hash",
    fullName: "System Administrator",
    role: "ADMIN",
  },
  {
    email: "librarian@library.local",
    passwordHash: "librarian123-hash",
    fullName: "Main Librarian",
    role: "LIBRARIAN",
  },
  {
    email: "student1@library.local",
    passwordHash: "student123-hash",
    fullName: "Student One",
    role: "MEMBER",
  },
  {
    email: "student2@library.local",
    passwordHash: "student123-hash",
    fullName: "Student Two",
    role: "MEMBER",
  },
];

const categories = ["技术", "小说", "科学", "历史", "管理"];

const books = [
  // 技术
  { isbn: "9787302511001", title: "Node.js 实战指南", author: "陈涛", category: "技术" },
  { isbn: "9787115581246", title: "JavaScript 高级程序设计", author: "Nicholas C. Zakas", category: "技术" },
  { isbn: "9787115473268", title: "深入浅出 TypeScript", author: "王磊", category: "技术" },
  { isbn: "9787121399989", title: "数据库系统原理", author: "李宏毅", category: "技术" },
  // 小说
  { isbn: "9787020002207", title: "活着", author: "余华", category: "小说" },
  { isbn: "9787020139873", title: "百年孤独", author: "加西亚·马尔克斯", category: "小说" },
  { isbn: "9787530210291", title: "解忧杂货店", author: "东野圭吾", category: "小说" },
  { isbn: "9787544291170", title: "三体", author: "刘慈欣", category: "小说" },
  // 科学
  { isbn: "9787544270878", title: "时间简史", author: "斯蒂芬·霍金", category: "科学" },
  { isbn: "9787544383776", title: "万物简史", author: "比尔·布莱森", category: "科学" },
  { isbn: "9787115428022", title: "科学的旅程", author: "雷蒙德·A·塞尔韦", category: "科学" },
  { isbn: "9787508698643", title: "人类简史", author: "尤瓦尔·赫拉利", category: "科学" },
  // 历史
  { isbn: "9787108021056", title: "史记选读", author: "司马迁", category: "历史" },
  { isbn: "9787108066071", title: "中国通史", author: "吕思勉", category: "历史" },
  { isbn: "9787108041535", title: "万历十五年", author: "黄仁宇", category: "历史" },
  { isbn: "9787020152407", title: "枪炮、病菌与钢铁", author: "贾雷德·戴蒙德", category: "历史" },
  // 管理
  { isbn: "9787508639714", title: "高效能人士的七个习惯", author: "史蒂芬·柯维", category: "管理" },
  { isbn: "9787508684035", title: "从优秀到卓越", author: "吉姆·柯林斯", category: "管理" },
  { isbn: "9787111561273", title: "管理学原理", author: "周三多", category: "管理" },
  { isbn: "9787508680907", title: "OKR 工作法", author: "约翰·杜尔", category: "管理" },
];

async function main() {
  // Reset core business tables for deterministic seed output.
  await prisma.auditLog.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.hold.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
  await prisma.config.deleteMany();

  const usersByEmail = {};
  for (const user of userSeeds) {
    const created = await prisma.user.create({ data: user });
    usersByEmail[created.email] = created;
  }

  if (categories.some((c) => !books.some((b) => b.category === c))) {
    throw new Error("Book categories are not fully covered.");
  }

  const createdBooks = [];
  for (let i = 0; i < books.length; i += 1) {
    const book = books[i];
    const isAvailable = i < 15;
    const created = await prisma.book.create({
      data: {
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        category: book.category,
        totalCopies: 1,
        availableCopies: isAvailable ? 1 : 0,
      },
    });
    createdBooks.push(created);
  }

  const borrowedBooks = createdBooks.slice(15);
  const borrowers = [
    usersByEmail["student1@library.local"],
    usersByEmail["student2@library.local"],
  ];

  for (let i = 0; i < borrowedBooks.length; i += 1) {
    const borrower = borrowers[i % borrowers.length];
    await prisma.loan.create({
      data: {
        userId: borrower.id,
        bookId: borrowedBooks[i].id,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: "BORROWED",
      },
    });
  }

  await prisma.config.upsert({
    where: { key: "FINE_RATE_PER_DAY" },
    create: {
      key: "FINE_RATE_PER_DAY",
      value: "0.50",
      description: "Fine amount charged per overdue day.",
      updatedBy: "admin@library.local",
    },
    update: {
      value: "0.50",
      description: "Fine amount charged per overdue day.",
      updatedBy: "admin@library.local",
    },
  });

  console.log("Seed completed:");
  console.log("- 4 users (1 admin, 1 librarian, 2 students)");
  console.log("- 20 books across 5 categories");
  console.log("- 15 available books, 5 borrowed books");
  console.log("- Config key FINE_RATE_PER_DAY set to 0.50");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
