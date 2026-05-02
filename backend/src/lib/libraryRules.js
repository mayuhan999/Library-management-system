const { prisma } = require('./prisma');

async function getConfigNumber(key, fallback) {
  const row = await prisma.config.findUnique({ where: { key } });
  const n = parseFloat(String(row?.value ?? ''));
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

async function getLoanDays() {
  const n = await getConfigNumber('LOAN_DAYS', 14);
  return Math.min(365, Math.max(1, Math.floor(n)));
}

async function getMinPasswordLength() {
  const n = await getConfigNumber('MIN_PASSWORD_LENGTH', 6);
  return Math.min(128, Math.max(6, Math.floor(n)));
}

/** Max concurrent active loans per reader (Release 1 borrowing cap). */
async function getMaxBorrowBooks() {
  const n = await getConfigNumber('MAX_BORROW_BOOKS', 5);
  return Math.min(50, Math.max(1, Math.floor(n)));
}

async function getMaxRenewCount() {
  const n = await getConfigNumber('MAX_RENEW_COUNT', 1);
  return Math.min(10, Math.max(0, Math.floor(n)));
}

async function getFineRatePerDay() {
  const n = await getConfigNumber('FINE_RATE_PER_DAY', 0);
  return Math.max(0, n);
}

module.exports = { getLoanDays, getMinPasswordLength, getMaxBorrowBooks, getMaxRenewCount, getFineRatePerDay, getConfigNumber };
