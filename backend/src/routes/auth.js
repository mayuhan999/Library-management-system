const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { getMinPasswordLength } = require('../lib/libraryRules');
const { requireAuth, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const JWT_EXPIRES = '7d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES },
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
  };
}

router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body || {};
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  const minLen = await getMinPasswordLength();

  if (!trimmedEmail || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
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
      role: 'MEMBER',
    },
  });

  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
});

const INTENT_ROLES = new Set(['MEMBER', 'LIBRARIAN', 'ADMIN']);

router.post('/login', async (req, res) => {
  const { email, password, intentRole } = req.body || {};
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!trimmedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: 'This account has been disabled' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (intentRole != null && intentRole !== '') {
    if (!INTENT_ROLES.has(intentRole)) {
      return res.status(400).json({ error: 'Invalid login portal' });
    }
    if (user.role !== intentRole) {
      return res.status(403).json({
        error: 'This account does not match the selected portal. Choose the correct sign-in page.',
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    },
  });

  const token = signToken(user);
  return res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'User not found or account disabled' });
  }
  return res.json({ user: publicUser(user) });
});

module.exports = router;
