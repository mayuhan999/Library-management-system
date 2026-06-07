const { createMessage } = require('./inAppMessages');

const QUEUE_STATUSES = ['ACTIVE', 'APPROVED'];

/** Recalculate Book.totalCopies / availableCopies from copy rows. */
async function syncBookCounters(tx, bookId) {
  const copies = await tx.bookCopy.findMany({ where: { bookId } });
  if (copies.length === 0) return null;

  const totalCopies = copies.length;
  const availableCopies = copies.filter((c) => c.status === 'AVAILABLE').length;

  return tx.book.update({
    where: { id: bookId },
    data: { totalCopies, availableCopies },
  });
}

/**
 * When a copy becomes available, promote the next hold to READY and notify the reader.
 */
async function promoteNextHoldForBook(tx, bookId, auditUserId) {
  const book = await tx.book.findUnique({ where: { id: bookId } });
  if (!book || book.availableCopies < 1) return null;

  const nextHold = await tx.hold.findFirst({
    where: { bookId, status: { in: QUEUE_STATUSES } },
    orderBy: { placedAt: 'asc' },
    include: { book: { select: { title: true } }, user: { select: { id: true } } },
  });

  if (!nextHold) return null;

  const updated = await tx.hold.update({
    where: { id: nextHold.id },
    data: { status: 'READY', readyAt: new Date() },
  });

  await createMessage(tx, {
    userId: nextHold.userId,
    type: 'HOLD_READY',
    title: 'Reserved book ready for pickup',
    body: `"${nextHold.book.title}" is now available. Please visit the desk within 7 days.`,
    relatedEntityType: 'Hold',
    relatedEntityId: nextHold.id,
  });

  await tx.auditLog.create({
    data: {
      userId: auditUserId || null,
      action: 'UPDATE',
      entityType: 'Hold',
      entityId: nextHold.id,
      details: JSON.stringify({ action: 'AUTO_READY', bookId }),
    },
  });

  return updated;
}

module.exports = { syncBookCounters, promoteNextHoldForBook, QUEUE_STATUSES };
