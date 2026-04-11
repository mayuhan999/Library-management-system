const express = require('express');
const { prisma } = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const where = q
    ? {
        OR: [
          { title: { contains: q } },
          { author: { contains: q } },
          { description: { contains: q } },
          { category: { contains: q } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.book.findMany({
      where,
      orderBy: [{ title: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.book.count({ where }),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

router.get('/:id', async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id } });
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  res.json(book);
});

module.exports = router;
