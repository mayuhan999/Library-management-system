const { prisma } = require('./prisma');
const { processDueReminders } = require('./dueReminders');
const { createBackup, pruneOldBackups } = require('./databaseBackup');
const { getAutoBackupEnabled, getAutoBackupIntervalHours } = require('./libraryRules');

let dueReminderTimer = null;
let autoBackupTimer = null;

async function isAutoBackupEnabled() {
  return getAutoBackupEnabled();
}

async function runDueReminders() {
  try {
    const result = await processDueReminders();
    if (result.created > 0) {
      console.log(`[scheduler] Due reminders: ${result.created} new message(s)`);
    }
  } catch (e) {
    console.error('[scheduler] Due reminder job failed:', e.message);
  }
}

async function runAutoBackup() {
  try {
    const enabled = await isAutoBackupEnabled();
    if (!enabled) return;

    const { filename } = await createBackup('auto');
    const pruned = await pruneOldBackups();
    console.log(`[scheduler] Auto backup created: ${filename} (pruned ${pruned.pruned})`);
  } catch (e) {
    console.error('[scheduler] Auto backup failed:', e.message);
  }
}

/** Expire holds past expiresAt that are still ACTIVE/APPROVED. */
async function expireStaleHolds() {
  try {
    const now = new Date();
    const stale = await prisma.hold.findMany({
      where: {
        status: { in: ['ACTIVE', 'APPROVED'] },
        expiresAt: { lt: now },
      },
      take: 200,
    });

    for (const hold of stale) {
      await prisma.hold.update({
        where: { id: hold.id },
        data: { status: 'EXPIRED', cancelledAt: now },
      });
    }

    if (stale.length > 0) {
      console.log(`[scheduler] Expired ${stale.length} stale hold(s)`);
    }
  } catch (e) {
    console.error('[scheduler] Hold expiry job failed:', e.message);
  }
}

async function tickMaintenance() {
  await runDueReminders();
  await expireStaleHolds();
}

function startScheduler() {
  // Due reminders + hold expiry every hour
  runDueReminders();
  expireStaleHolds();
  dueReminderTimer = setInterval(tickMaintenance, 60 * 60 * 1000);

  // Auto backup on interval from config (check every 15 min)
  const backupCheckMs = 15 * 60 * 1000;
  autoBackupTimer = setInterval(async () => {
    const enabled = await isAutoBackupEnabled();
    if (!enabled) return;

    const hours = await getAutoBackupIntervalHours();
    const lastRow = await prisma.config.findUnique({ where: { key: 'AUTO_BACKUP_LAST_RUN' } });
    const lastRun = lastRow?.value ? new Date(lastRow.value) : null;
    const due =
      !lastRun || Date.now() - lastRun.getTime() >= hours * 60 * 60 * 1000;

    if (due) {
      await runAutoBackup();
      await prisma.config.upsert({
        where: { key: 'AUTO_BACKUP_LAST_RUN' },
        create: { key: 'AUTO_BACKUP_LAST_RUN', value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      });
    }
  }, backupCheckMs);

  console.log('[scheduler] R3 background jobs started');
}

function stopScheduler() {
  if (dueReminderTimer) clearInterval(dueReminderTimer);
  if (autoBackupTimer) clearInterval(autoBackupTimer);
}

module.exports = { startScheduler, stopScheduler, runDueReminders, runAutoBackup };
