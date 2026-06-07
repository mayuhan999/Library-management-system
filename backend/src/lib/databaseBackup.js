const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { getAutoBackupRetentionDays } = require('./libraryRules');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

function resolveDbPath() {
  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const relative = url.replace(/^file:/, '');
  return path.isAbsolute(relative)
    ? relative
    : path.join(__dirname, '..', '..', relative.replace(/^\.\//, ''));
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatTimestamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function listBackups() {
  ensureBackupDir();
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((filename) => {
      const full = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(full);
      return {
        filename,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return files;
}

async function createBackup(label = 'manual') {
  ensureBackupDir();
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error('DATABASE_NOT_FOUND');
  }

  const filename = `library-${label}-${formatTimestamp()}.db`;
  const dest = path.join(BACKUP_DIR, filename);

  const source = new Database(dbPath, { readonly: true });
  try {
    await source.backup(dest);
  } finally {
    source.close();
  }

  if (!fs.existsSync(dest)) {
    throw new Error('BACKUP_FAILED');
  }

  return { filename, path: dest, sizeBytes: fs.statSync(dest).size };
}

function restoreBackup(filename) {
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('INVALID_FILENAME');
  }

  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) {
    throw new Error('BACKUP_NOT_FOUND');
  }

  const dbPath = resolveDbPath();
  fs.copyFileSync(src, dbPath);
  return { restored: filename, dbPath };
}

async function pruneOldBackups() {
  const retentionDays = await getAutoBackupRetentionDays();
  if (retentionDays <= 0) return { pruned: 0 };

  ensureBackupDir();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  for (const file of listBackups()) {
    if (new Date(file.createdAt).getTime() < cutoff) {
      fs.unlinkSync(path.join(BACKUP_DIR, file.filename));
      pruned += 1;
    }
  }

  return { pruned };
}

module.exports = {
  BACKUP_DIR,
  resolveDbPath,
  listBackups,
  createBackup,
  restoreBackup,
  pruneOldBackups,
};
