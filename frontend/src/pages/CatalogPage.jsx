import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BorrowAvailability } from '@/components/BorrowAvailability'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

function readStr(sp, key) {
  return (sp.get(key) || '').trim()
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const urlFilters = useMemo(
    () => ({
      q: readStr(searchParams, 'q'),
      title: readStr(searchParams, 'title'),
      author: readStr(searchParams, 'author'),
      isbn: readStr(searchParams, 'isbn'),
      category: readStr(searchParams, 'category'),
    }),
    [searchParams],
  )

  const [q, setQ] = useState(urlFilters.q)
  const [title, setTitle] = useState(urlFilters.title)
  const [author, setAuthor] = useState(urlFilters.author)
  const [isbn, setIsbn] = useState(urlFilters.isbn)
  const [category, setCategory] = useState(urlFilters.category)

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setQ(urlFilters.q)
    setTitle(urlFilters.title)
    setAuthor(urlFilters.author)
    setIsbn(urlFilters.isbn)
    setCategory(urlFilters.category)
  }, [urlFilters])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('limit', '12')
      if (urlFilters.q) qs.set('q', urlFilters.q)
      if (urlFilters.title) qs.set('title', urlFilters.title)
      if (urlFilters.author) qs.set('author', urlFilters.author)
      if (urlFilters.isbn) qs.set('isbn', urlFilters.isbn)
      if (urlFilters.category) qs.set('category', urlFilters.category)
      const res = await apiFetch(`/api/books?${qs.toString()}`)
      setData(res)
    } catch (err) {
      setError(err.message || 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, urlFilters])

  useEffect(() => {
    load()
  }, [load])

  function buildParamsFromInputs(nextPage = 1) {
    const next = new URLSearchParams()
    next.set('page', String(nextPage))
    if (q.trim()) next.set('q', q.trim())
    if (title.trim()) next.set('title', title.trim())
    if (author.trim()) next.set('author', author.trim())
    if (isbn.trim()) next.set('isbn', isbn.trim())
    if (category.trim()) next.set('category', category.trim())
    return next
  }

  function paramsFromApplied(applied, nextPage = 1) {
    const next = new URLSearchParams()
    next.set('page', String(nextPage))
    if (applied.q) next.set('q', applied.q)
    if (applied.title) next.set('title', applied.title)
    if (applied.author) next.set('author', applied.author)
    if (applied.isbn) next.set('isbn', applied.isbn)
    if (applied.category) next.set('category', applied.category)
    return next
  }

  function handleSearch(e) {
    e.preventDefault()
    setSearchParams(buildParamsFromInputs(1))
  }

  function clearAll() {
    setQ('')
    setTitle('')
    setAuthor('')
    setIsbn('')
    setCategory('')
    setSearchParams(new URLSearchParams({ page: '1' }))
  }

  function goPage(p) {
    setSearchParams(paramsFromApplied(urlFilters, p))
  }

  const hasFilters = Boolean(
    urlFilters.q || urlFilters.title || urlFilters.author || urlFilters.isbn || urlFilters.category,
  )

  return (
    <div className="b-app space-y-8">
      <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-base font-semibold text-[#003366]">Search the catalog</h2>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          Filter by title, author, ISBN, or category; or use a keyword across fields.
        </p>
        <form onSubmit={handleSearch} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="catalog-q">
              Keyword (optional)
            </label>
            <input
              id="catalog-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, author, ISBN, category…"
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Author</label>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">ISBN</label>
              <input value={isbn} onChange={(e) => setIsbn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Search</Button>
            <Button type="button" variant="secondary" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[#003366]">{hasFilters ? 'Search results' : 'Browse books'}</h2>
        {hasFilters ? (
          <p className="text-sm text-[#5c6b7a]">
            Filters applied.{' '}
            <button type="button" className="font-medium text-[#003366] underline-offset-2 hover:underline" onClick={clearAll}>
              Clear all
            </button>
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#5c6b7a]">Loading…</p>
        ) : error ? (
          <p className="text-sm text-[#b42318]">{error}</p>
        ) : data?.items?.length === 0 ? (
          <p className="text-sm text-[#5c6b7a]">No books match. Try different keywords.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-sm border border-[#e5e8eb] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                      <th className="px-3 py-2 font-medium text-[#3d4f5f]">Title</th>
                      <th className="px-3 py-2 font-medium text-[#3d4f5f]">Author</th>
                      <th className="px-3 py-2 font-medium text-[#3d4f5f]">ISBN</th>
                      <th className="px-3 py-2 font-medium text-[#3d4f5f]">Category</th>
                      <th className="px-3 py-2 font-medium text-[#3d4f5f]">Status</th>
                      <th className="px-3 py-2 text-right font-medium text-[#3d4f5f]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((book) => (
                      <tr key={book.id} className="border-b border-[#f0f2f4] hover:bg-[#fafafa]">
                        <td className="px-3 py-2.5">
                          <Link to={`/books/${book.id}`} className="font-semibold text-[#003366] hover:underline">
                            {book.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-[#1a2b3c]">{book.author}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#5c6b7a]">{book.isbn}</td>
                        <td className="px-3 py-2.5 text-[#5c6b7a]">{book.category || '—'}</td>
                        <td className="px-3 py-2.5">
                          <BorrowAvailability available={book.availableCopies} total={book.totalCopies} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link to={`/books/${book.id}`} className="text-sm font-medium text-[#003366] hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {data.totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-[#5c6b7a]">
                  Page {page} / {data.totalPages} · {data.total} books
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => goPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            ) : (
              <p className="pt-2 text-center text-sm text-[#5c6b7a]">
                {data.total} {data.total === 1 ? 'book' : 'books'} total
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
