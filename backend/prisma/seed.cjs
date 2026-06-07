const path = require("node:path");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { createUniqueBarcodes } = require("../src/lib/libraryBarcode");
const { CONFIG_DEFAULTS } = require("../src/lib/configDefaults");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/** 明文密码仅用于开发环境种子；登录时使用 bcrypt 校验 */
const userSeedDefs = [
  {
    email: "admin@library.local",
    password: "admin123",
    fullName: "System Administrator",
    role: "ADMIN",
  },
  {
    email: "librarian@library.local",
    password: "librarian123",
    fullName: "Main Librarian",
    role: "LIBRARIAN",
  },
  {
    email: "student1@library.local",
    password: "student123",
    fullName: "Student One",
    role: "MEMBER",
  },
  {
    email: "student2@library.local",
    password: "student123",
    fullName: "Student Two",
    role: "MEMBER",
  },
  {
    email: "student3@library.local",
    password: "student123",
    fullName: "Student Three",
    role: "MEMBER",
  },
  {
    email: "student4@library.local",
    password: "student123",
    fullName: "Student Four",
    role: "MEMBER",
  },
  {
    email: "student5@library.local",
    password: "student123",
    fullName: "Student Five",
    role: "MEMBER",
  },
];

const categories = ["技术", "小说", "科学", "历史", "管理"];

/** Random integer in [min, max] inclusive. */
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const books = [
  // 技术
  {
    isbn: "9787302511001",
    title: "Node.js 实战指南",
    author: "陈涛",
    category: "技术",
    description: "Node.js 服务端开发与工程实践，涵盖模块、异步与部署。",
  },
  {
    isbn: "9787115581246",
    title: "JavaScript 高级程序设计",
    author: "Nicholas C. Zakas",
    category: "技术",
    description: "前端与 JavaScript 语言核心概念、DOM、面向对象与最佳实践。",
  },
  {
    isbn: "9787115473268",
    title: "深入浅出 TypeScript",
    author: "王磊",
    category: "技术",
    description: "TypeScript 类型系统、泛型与在大型项目中的应用。",
  },
  {
    isbn: "9787121399989",
    title: "数据库系统原理",
    author: "李宏毅",
    category: "技术",
    description: "关系模型、SQL、事务与存储，数据库设计与优化入门。",
  },
  // 小说
  {
    isbn: "9787020002207",
    title: "活着",
    author: "余华",
    category: "小说",
    description: "一个人与命运交织的家庭史，关于苦难与坚韧的当代文学经典。",
  },
  {
    isbn: "9787020139873",
    title: "百年孤独",
    author: "加西亚·马尔克斯",
    category: "小说",
    description: "魔幻现实主义代表作，布恩迪亚家族七代人的传奇与孤独。",
  },
  {
    isbn: "9787530210291",
    title: "解忧杂货店",
    author: "东野圭吾",
    category: "小说",
    description: "穿越时空的信件与温情推理，关于选择与救赎的故事。",
  },
  {
    isbn: "9787544291170",
    title: "三体",
    author: "刘慈欣",
    category: "小说",
    description: "地球文明与三体文明首次接触，硬科幻与宇宙社会学的史诗。",
  },
  // 科学
  {
    isbn: "9787544270878",
    title: "时间简史",
    author: "斯蒂芬·霍金",
    category: "科学",
    description: "宇宙、黑洞与时间箭头，面向普通读者的理论物理科普。",
  },
  {
    isbn: "9787544383776",
    title: "万物简史",
    author: "比尔·布莱森",
    category: "科学",
    description: "从宇宙大爆炸到生命演化，幽默笔法串起科学史。",
  },
  {
    isbn: "9787115428022",
    title: "科学的旅程",
    author: "雷蒙德·A·塞尔韦",
    category: "科学",
    description: "科学思想史与重大发现背后的故事。",
  },
  {
    isbn: "9787508698643",
    title: "人类简史",
    author: "尤瓦尔·赫拉利",
    category: "科学",
    description: "从认知革命到智人统治地球的历史叙事与反思。",
  },
  // 历史
  {
    isbn: "9787108021056",
    title: "史记选读",
    author: "司马迁",
    category: "历史",
    description: "纪传体史书节选，人物与事件兼具文学与史料价值。",
  },
  {
    isbn: "9787108066071",
    title: "中国通史",
    author: "吕思勉",
    category: "历史",
    description: "中国历史脉络与制度演变的通识读本。",
  },
  {
    isbn: "9787108041535",
    title: "万历十五年",
    author: "黄仁宇",
    category: "历史",
    description: "以一年切片透视明代官僚体系与大历史观。",
  },
  {
    isbn: "9787020152407",
    title: "枪炮、病菌与钢铁",
    author: "贾雷德·戴蒙德",
    category: "历史",
    description: "地理环境如何塑造不同文明的发展轨迹。",
  },
  // 管理
  {
    isbn: "9787508639714",
    title: "高效能人士的七个习惯",
    author: "史蒂芬·柯维",
    category: "管理",
    description: "主动积极、以终为始等习惯框架，个人与团队效能提升。",
  },
  {
    isbn: "9787508684035",
    title: "从优秀到卓越",
    author: "吉姆·柯林斯",
    category: "管理",
    description: "企业从平庸走向卓越的实证研究与飞轮理念。",
  },
  {
    isbn: "9787111561273",
    title: "管理学原理",
    author: "周三多",
    category: "管理",
    description: "计划、组织、领导与控制等管理学基础概念。",
  },
  {
    isbn: "9787508680907",
    title: "OKR 工作法",
    author: "约翰·杜尔",
    category: "管理",
    description: "目标与关键结果方法论及硅谷实践案例。",
  },
];

async function main() {
  // Reset core business tables for deterministic seed output.
  await prisma.auditLog.deleteMany();
  await prisma.inAppMessage.deleteMany();
  await prisma.bookCopyIncident.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.hold.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.bookCopy.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
  await prisma.config.deleteMany();

  const usersByEmail = {};
  for (const def of userSeedDefs) {
    const passwordHash = await bcrypt.hash(def.password, 10);
    const created = await prisma.user.create({
      data: {
        email: def.email,
        passwordHash,
        fullName: def.fullName,
        role: def.role,
      },
    });
    usersByEmail[created.email] = created;
  }

  if (categories.some((c) => !books.some((b) => b.category === c))) {
    throw new Error("Book categories are not fully covered.");
  }

  const memberEmails = [
    "student1@library.local",
    "student2@library.local",
    "student3@library.local",
    "student4@library.local",
    "student5@library.local",
  ];
  const memberUsers = memberEmails.map((e) => usersByEmail[e]);

  const createdBooks = [];
  for (let i = 0; i < books.length; i += 1) {
    const book = books[i];
    const totalCopies = randomInt(2, 5);
    const shelfOnly = i < 15;
    const availableCopies = shelfOnly ? totalCopies : 0;
    const created = await prisma.book.create({
      data: {
        isbn: book.isbn,
        barcode: book.isbn.replace(/[-\s]/g, ''),
        title: book.title,
        author: book.author,
        category: book.category,
        description: book.description,
        language: "zh-Hans",
        totalCopies,
        availableCopies,
      },
    });

    const barcodes = await createUniqueBarcodes(prisma, totalCopies);
    await prisma.bookCopy.createMany({
      data: barcodes.map((libraryBarcode) => ({
        bookId: created.id,
        libraryBarcode,
        status: "AVAILABLE",
      })),
    });

    createdBooks.push({ created, shelfOnly, totalCopies });
  }

  // Last 5 titles: every copy is on loan (availableCopies === 0). One loan per copy, distinct patrons.
  for (const entry of createdBooks) {
    if (entry.shelfOnly) continue;
    const { created, totalCopies } = entry;
    const copies = await prisma.bookCopy.findMany({
      where: { bookId: created.id, status: "AVAILABLE" },
      orderBy: { libraryBarcode: "asc" },
    });
    for (let k = 0; k < totalCopies; k += 1) {
      const copy = copies[k];
      const borrower = memberUsers[k % memberUsers.length];
      await prisma.$transaction(async (tx) => {
        await tx.bookCopy.update({
          where: { id: copy.id },
          data: { status: "ON_LOAN" },
        });
        await tx.book.update({
          where: { id: created.id },
          data: { availableCopies: { decrement: 1 } },
        });
        await tx.loan.create({
          data: {
            userId: borrower.id,
            bookId: created.id,
            bookCopyId: copy.id,
            dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: "BORROWED",
          },
        });
      });
    }
  }

  for (const row of CONFIG_DEFAULTS) {
    await prisma.config.upsert({
      where: { key: row.key },
      create: { ...row, updatedBy: "admin@library.local" },
      update: { description: row.description, updatedBy: "admin@library.local" },
    });
  }

  console.log("Seed completed:");
  console.log("- 8 users (1 admin, 1 librarian, 5 students)");
  console.log("- 20 books across 5 categories, 2–5 copies each (random)");
  console.log("- First 15 books: all copies on shelf; last 5: all copies on loan (unavailable)");
  console.log("- Config: all defaults incl. REMINDER_DAYS_AHEAD, AUTO_BACKUP_*");
  console.log("- Next: npm run demo:r3  (R3 acceptance demo data)");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
