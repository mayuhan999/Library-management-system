const { prisma } = require('./prisma');

/**
 * Create an in-app message, skipping duplicates when relatedEntity is provided.
 */
async function createMessage(tx, {
  userId,
  type,
  title,
  body,
  relatedEntityType,
  relatedEntityId,
}) {
  const client = tx || prisma;

  if (relatedEntityType && relatedEntityId) {
    const existing = await client.inAppMessage.findFirst({
      where: {
        userId,
        type,
        relatedEntityType,
        relatedEntityId,
      },
    });
    if (existing) return existing;
  }

  return client.inAppMessage.create({
    data: {
      userId,
      type,
      title,
      body,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
    },
  });
}

module.exports = { createMessage };
