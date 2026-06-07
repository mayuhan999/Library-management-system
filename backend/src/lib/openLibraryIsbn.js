const OL_AGENT = 'LibraryManagementSystem/1.0 (local; isbn-lookup)';

function normalizeIsbnInput(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[-\s]/g, '').trim();
}

function isValidIsbnDigits(clean) {
  if (!/^\d{9}[\dXx]$|^\d{13}$/.test(clean)) return false;
  return true;
}

/**
 * Fetch bibliographic metadata from Open Library (free, no API key).
 * @param {string} isbn
 * @returns {Promise<{
 *   isbn: string,
 *   title: string | null,
 *   authors: string,
 *   publisher: string | null,
 *   publishedYear: number | null,
 *   language: string | null,
 *   description: string | null,
 *   coverImageUrl: string | null,
 *   subjects: string[] | null,
 * } | null>}
 */
async function lookupIsbnMetadata(isbn) {
  const clean = normalizeIsbnInput(isbn);
  if (!clean || !isValidIsbnDigits(clean)) {
    const err = new Error('INVALID_ISBN');
    throw err;
  }

  const searchUrl = `https://openlibrary.org/search.json?q=isbn:${encodeURIComponent(clean)}&limit=1`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': OL_AGENT },
  });

  if (!searchRes.ok) {
    const err = new Error('ISBN_LOOKUP_FAILED');
    err.status = searchRes.status;
    throw err;
  }

  const searchJson = await searchRes.json();
  const doc = searchJson?.docs?.[0];
  if (!doc) {
    return null;
  }

  const title = typeof doc.title === 'string' ? doc.title : null;
  const authorNames = Array.isArray(doc.author_name) ? doc.author_name.filter(Boolean) : [];
  const authors = authorNames.join(', ') || '';

  let publishedYear = null;
  const yRaw = doc.first_publish_year ?? (Array.isArray(doc.publish_year) ? doc.publish_year[0] : null);
  if (yRaw != null) {
    const y = parseInt(String(yRaw), 10);
    publishedYear = Number.isFinite(y) ? y : null;
  }

  const pub = Array.isArray(doc.publisher) ? doc.publisher[0] : null;
  const publisher = typeof pub === 'string' ? pub : null;

  const lang = Array.isArray(doc.language) ? doc.language[0] : null;
  const language = typeof lang === 'string' ? lang : null;

  const isbnKey = `ISBN:${clean}`;
  let coverImageUrl = null;
  try {
    const covUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(clean)}-M.jpg`;
    const head = await fetch(covUrl, { method: 'HEAD', headers: { 'User-Agent': OL_AGENT } });
    if (head.ok) coverImageUrl = covUrl;
  } catch {
    coverImageUrl = null;
  }

  const subjects = Array.isArray(doc.subject)
    ? doc.subject.slice(0, 8).filter((s) => typeof s === 'string')
    : null;

  let description = null;
  if (doc.key) {
    try {
      const workRes = await fetch(`https://openlibrary.org${doc.key}.json`, {
        headers: { 'User-Agent': OL_AGENT },
      });
      if (workRes.ok) {
        const work = await workRes.json();
        if (typeof work.description === 'string') {
          description = work.description;
        } else if (work.description?.value) {
          description = String(work.description.value);
        }
      }
    } catch {
      description = null;
    }
  }

  return {
    isbn: clean,
    title,
    authors,
    publisher,
    publishedYear,
    language,
    description,
    coverImageUrl,
    subjects,
    source: {
      openLibraryKey: doc.key || null,
      isbnSearchKey: isbnKey,
    },
  };
}

module.exports = {
  normalizeIsbnInput,
  lookupIsbnMetadata,
};
