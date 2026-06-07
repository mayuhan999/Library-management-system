const crypto = require('crypto');

/** Library-owned barcode (Code128-friendly). Intentionally not ISBN-shaped. */
function generateLibraryBarcodeValue() {
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `LIB${hex.slice(0, 12)}`;
}

/**
 * @param {import('@prisma/client').PrismaClient} client
 * @param {number} count
 * @returns {Promise<string[]>}
 */
async function createUniqueBarcodes(client, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    let barcode;
    let attempts = 0;
    do {
      barcode = generateLibraryBarcodeValue();
      attempts += 1;
      if (attempts > 50) {
        throw new Error('Failed to allocate a unique library barcode');
      }
      // eslint-disable-next-line no-await-in-loop
      const clash = await client.bookCopy.findUnique({ where: { libraryBarcode: barcode } });
      if (!clash) break;
    } while (true);
    out.push(barcode);
  }
  return out;
}

module.exports = {
  generateLibraryBarcodeValue,
  createUniqueBarcodes,
};
