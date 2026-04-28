const express = require('express');
const bcrypt = require('bcrypt');
const { prisma } = require('../lib/prisma');
const { getMinPasswordLength } = require('../lib/libraryRules');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN']));

const ROLES = new Set(['MEMBER', 'LIBRARIAN', 'ADMIN']);

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
  res.json({ items: rows });
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

  const defaults = [
    {
      key: 'LOAN_DAYS',
      value: '14',
      description: 'Default loan period in days (online borrow & desk checkout).',
    },
    {
      key: 'MIN_PASSWORD_LENGTH',
      value: '6',
      description: 'Minimum password length for registration and admin-created accounts.',
    },
    {
      key: 'MAX_BORROW_BOOKS',
      value: '5',
      description: 'Maximum concurrent active loans per reader account.',
    },
    {
      key: 'MAX_RENEW_COUNT',
      value: '1',
      description: 'Maximum number of renewals allowed per loan (0 = renewals disabled).',
    },
    {
      key: 'FINE_RATE_PER_DAY',
      value: '0.50',
      description: 'Reserved for future overdue fines (Release 2+).',
    },
    {
      key: 'READER_CARD_ID_PATTERN',
      value: '^[A-Z0-9]{6,12}$',
      description: 'Suggested reader card ID format (regex, policy text).',
    },
  ];

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

module.exports = router;
