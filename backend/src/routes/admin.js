const express = require('express');
const bcrypt = require('bcrypt');
const { prisma } = require('../lib/prisma');
const { getMinPasswordLength } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listBackups, createBackup, restoreBackup } = require('../lib/databaseBackup');
const { CONFIG_DEFAULTS } = require('../lib/configDefaults');
const { getAdminDashboard } = require('../lib/dashboardStats');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN']));

const ROLES = new Set(['MEMBER', 'LIBRARIAN', 'ADMIN']);

/** A1.11 — Admin global dashboard. */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await getAdminDashboard();
    res.json(data);
  } catch (e) {
    console.error('GET /admin/dashboard', e);
    res.status(500).json({
      error: 'Dashboard unavailable. Run: cd backend && npx prisma migrate deploy',
      detail: e.message,
    });
  }
});

/** A1.10 — Alipay payment reconciliation ledger. */
router.get('/payments', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const where = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          loan: { include: { book: { select: { title: true, isbn: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    const summary = await prisma.payment.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amount: true },
    });

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      summary: summary.map((s) => ({
        status: s.status,
        count: s._count.id,
        amount: parseFloat((s._sum.amount || 0).toFixed(2)),
      })),
    });
  } catch (e) {
    console.error('GET /admin/payments', e);
    res.status(500).json({
      error: 'Payments ledger unavailable. Run: cd backend && npx prisma migrate deploy',
      detail: e.message,
    });
  }
});

router.get('/users', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { fullName: { contains: q } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

router.post('/users', async (req, res) => {
  const { email, password, fullName, role } = req.body || {};
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const minLen = await getMinPasswordLength();

  if (!trimmedEmail || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }
  if (!role || !ROLES.has(role)) {
    return res.status(400).json({ error: 'A valid role is required (MEMBER, LIBRARIAN, or ADMIN)' });
  }
  if (password.length < minLen) {
    return res.status(400).json({ error: `Password must be at least ${minLen} characters` });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'This email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: trimmedEmail,
      passwordHash,
      fullName: name,
      role,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      details: JSON.stringify({ email: user.email, role: user.role }),
    },
  });

  return res.status(201).json({ user });
});

router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { isActive, role, fullName, phone } = req.body || {};

  const data = {};
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (role != null) {
    if (!ROLES.has(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    data.role = role;
  }
  if (typeof fullName === 'string' && fullName.trim()) data.fullName = fullName.trim();
  if (phone === null || phone === '') data.phone = null;
  else if (typeof phone === 'string') data.phone = phone.trim() || null;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No changes provided' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify(data),
      },
    });

    return res.json({ user });
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    throw e;
  }
});

/** Reset a user's password (admin action). Returns a temporary plaintext password. */
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-4);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ action: 'PASSWORD_RESET', targetEmail: user.email }),
      },
    });

    res.json({ user, tempPassword });
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    throw e;
  }
});

router.get('/config', async (req, res) => {
  const rows = await prisma.config.findMany({ orderBy: { key: 'asc' } });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const items = CONFIG_DEFAULTS.map((def) => {
    const saved = byKey[def.key];
    if (saved) return saved;
    return {
      id: `default-${def.key}`,
      key: def.key,
      value: def.value,
      description: def.description,
      updatedBy: null,
      createdAt: null,
      updatedAt: null,
      isDefault: true,
    };
  });
  for (const row of rows) {
    if (!CONFIG_DEFAULTS.some((d) => d.key === row.key)) {
      items.push(row);
    }
  }
  items.sort((a, b) => a.key.localeCompare(b.key));
  res.json({ items });
});

router.patch('/config', async (req, res) => {
  const entries = req.body?.entries;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'entries must be an array of { key, value }' });
  }

  const actor = await prisma.user.findUnique({ where: { id: req.userId } });
  const updatedBy = actor?.email || req.userId;

  const results = [];
  for (const row of entries) {
    const key = typeof row?.key === 'string' ? row.key.trim() : '';
    const value = row?.value != null ? String(row.value) : '';
    if (!key) continue;

    const saved = await prisma.config.upsert({
      where: { key },
      create: {
        key,
        value,
        description: typeof row.description === 'string' ? row.description : null,
        updatedBy,
      },
      update: { value, updatedBy, ...(row.description ? { description: row.description } : {}) },
    });
    results.push(saved);
  }

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Config',
      entityId: 'batch',
      details: JSON.stringify({ keys: results.map((r) => r.key) }),
    },
  });

  return res.json({ items: results });
});

/** Update a single config key. */
router.put('/config/:key', async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body || {};

  if (value == null) {
    return res.status(400).json({ error: 'value is required' });
  }

  const actor = await prisma.user.findUnique({ where: { id: req.userId } });
  const updatedBy = actor?.email || req.userId;

  const saved = await prisma.config.upsert({
    where: { key },
    create: {
      key,
      value: String(value),
      description: typeof description === 'string' ? description : null,
      updatedBy,
    },
    update: {
      value: String(value),
      updatedBy,
      ...(description != null ? { description } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Config',
      entityId: key,
      details: JSON.stringify({ key, value: saved.value }),
    },
  });

  res.json({ item: saved });
});

/** Connection check + row counts (database "initialized" when tables respond). */
router.get('/database-status', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  const [users, books, loans, holds, configRows] = await Promise.all([
    prisma.user.count(),
    prisma.book.count(),
    prisma.loan.count(),
    prisma.hold.count(),
    prisma.config.count(),
  ]);
  res.json({
    ok: true,
    sqlite: true,
    counts: { users, books, loans, holds, configRows },
  });
});

/** Upsert default configuration keys if missing (safe "init rules" without shell access). */
router.post('/database-bootstrap', async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.userId } });
  const updatedBy = actor?.email || req.userId;

  const defaults = CONFIG_DEFAULTS;

  const items = [];
  for (const row of defaults) {
    const saved = await prisma.config.upsert({
      where: { key: row.key },
      create: { ...row, updatedBy },
      update: { description: row.description, updatedBy },
    });
    items.push(saved);
  }

  await prisma.auditLog.create({
    data: {
      userId: req.userId,
      action: 'UPDATE',
      entityType: 'Config',
      entityId: 'bootstrap',
      details: JSON.stringify({ keys: items.map((r) => r.key) }),
    },
  });

  res.json({ ok: true, items });
});

/** A1.09 — List available backup files. */
router.get('/database/backups', async (req, res) => {
  const items = listBackups();
  res.json({ items });
});

/** A1.09 — Create manual database backup. */
router.post('/database/backup', async (req, res) => {
  try {
    const result = await createBackup('manual');
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'CREATE',
        entityType: 'DatabaseBackup',
        entityId: result.filename,
        details: JSON.stringify({ sizeBytes: result.sizeBytes }),
      },
    });
    res.status(201).json({ ok: true, backup: result });
  } catch (e) {
    if (e.message === 'DATABASE_NOT_FOUND') {
      return res.status(404).json({ error: 'Database file not found' });
    }
    if (e.message === 'BACKUP_FAILED') {
      return res.status(500).json({ error: 'Backup file was not created' });
    }
    throw e;
  }
});

/** A1.09 — Restore database from a backup file (destructive). */
router.post('/database/restore', async (req, res) => {
  const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';
  const confirm = req.body?.confirm === true || req.body?.confirm === 'true';

  if (!filename) {
    return res.status(400).json({ error: 'filename is required' });
  }
  if (!confirm) {
    return res.status(400).json({ error: 'Set confirm: true to restore (this overwrites the live database)' });
  }

  try {
    const result = restoreBackup(filename);
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entityType: 'DatabaseBackup',
        entityId: filename,
        details: JSON.stringify({ action: 'RESTORE', dbPath: result.dbPath }),
      },
    });
    res.json({ ok: true, restored: filename });
  } catch (e) {
    if (e.message === 'INVALID_FILENAME') {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    if (e.message === 'BACKUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    throw e;
  }
});

module.exports = router;
