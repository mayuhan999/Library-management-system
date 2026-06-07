const { prisma } = require('./prisma');
const { getReminderDaysAhead } = require('./libraryRules');

function startOfDay(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function formatDueDate(dueAt) {
  return dueAt.toISOString().slice(0, 10);
}

function buildReminderContent(loan, now) {
  const dueStr = formatDueDate(loan.dueAt);
  const isOverdue = loan.dueAt < now;

  if (isOverdue) {
    const overdueDays = Math.ceil((now - loan.dueAt) / (1000 * 60 * 60 * 24));
    return {
      title: 'Loan overdue',
      body: `"${loan.book.title}" was due on ${dueStr} (${overdueDays} day(s) overdue). Please return at the desk as soon as possible.`,
    };
  }

  const daysLeft = Math.max(0, Math.ceil((loan.dueAt - now) / (1000 * 60 * 60 * 24)));
  return {
    title: 'Loan due soon',
    body: `"${loan.book.title}" is due on ${dueStr} (${daysLeft} day(s) left). Renew online or return at the desk.`,
  };
}

async function reminderAlreadySentToday(userId, loanId) {
  const existing = await prisma.inAppMessage.findFirst({
    where: {
      userId,
      type: 'DUE_REMINDER',
      relatedEntityType: 'Loan',
      relatedEntityId: loanId,
      createdAt: { gte: startOfDay() },
    },
  });
  return Boolean(existing);
}

async function createDueReminderForLoan(loan, now) {
  if (await reminderAlreadySentToday(loan.userId, loan.id)) {
    return null;
  }

  const { title, body } = buildReminderContent(loan, now);
  return prisma.inAppMessage.create({
    data: {
      userId: loan.userId,
      type: 'DUE_REMINDER',
      title,
      body,
      relatedEntityType: 'Loan',
      relatedEntityId: loan.id,
    },
  });
}

function loanNeedsReminder(loan, now, windowEnd) {
  if (loan.status !== 'BORROWED' || loan.returnedAt) return false;
  if (loan.dueAt < now) return true;
  return loan.dueAt <= windowEnd;
}

/**
 * Create due-date / overdue reminders for one reader (on page load or login).
 */
async function processDueRemindersForUser(userId) {
  const daysAhead = await getReminderDaysAhead();
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);
  windowEnd.setHours(23, 59, 59, 999);

  const loans = await prisma.loan.findMany({
    where: { userId, status: 'BORROWED', returnedAt: null },
    include: { book: { select: { title: true } } },
    take: 50,
  });

  let created = 0;
  for (const loan of loans) {
    if (!loanNeedsReminder(loan, now, windowEnd)) continue;
    const msg = await createDueReminderForLoan(loan, now);
    if (msg) created += 1;
  }

  return { scanned: loans.length, created };
}

/** Background job: all readers with loans needing reminders. */
async function processDueReminders() {
  const daysAhead = await getReminderDaysAhead();
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);
  windowEnd.setHours(23, 59, 59, 999);

  const loans = await prisma.loan.findMany({
    where: { status: 'BORROWED', returnedAt: null },
    include: {
      book: { select: { title: true } },
      user: { select: { id: true } },
    },
    take: 500,
  });

  let created = 0;
  for (const loan of loans) {
    if (!loanNeedsReminder(loan, now, windowEnd)) continue;
    const msg = await createDueReminderForLoan(loan, now);
    if (msg) created += 1;
  }

  return { scanned: loans.length, created };
}

module.exports = { processDueReminders, processDueRemindersForUser };
