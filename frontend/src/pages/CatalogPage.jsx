import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BorrowAvailability } from '@/components/BorrowAvailability'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const [input, setInput] = useState(q)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setInput(q)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('limit', '12')
      if (q) qs.set('q', q)
      const res = await apiFetch(`/api/books?${qs.toString()}`)
      setData(res)
    } catch (err) {
      setError(err.message || 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    const next = new URLSearchParams()
    if (input.trim()) next.set('q', input.trim())
    next.set('page', '1')
    setSearchParams(next)
  }

  function goPage(p) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    if (q) next.set('q', q)
    else next.delete('q')
    setSearchParams(next)
  }

  const inputClass =
    'border-input bg-background ring-offset-background focus:border-primary/45 focus-visible:ring-ring w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2'

  return (
    <div className="library-app space-y-10">
      <section className="library-panel space-y-6 p-6 sm:p-8">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Search the catalog
        </h2>
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <label className="text-muted-foreground block text-xs font-medium" htmlFor="catalog-q">
              Title, author, description, or category
            </label>
            <input
              id="catalog-q"
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. physics, Austen, ISBN…"
              className={inputClass}
            />
          </div>
          <Button type="submit" className="shrink-0 px-6 font-semibold shadow-sm">
            Search
          </Button>
        </form>
        {q ? (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-relaxed">
            <span>
              Keyword:{' '}
              <span className="text-foreground font-medium">{q}</span>
            </span>
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setInput('')
                setSearchParams(new URLSearchParams({ page: '1' }))
              }}
            >
              Clear
            </button>
          </p>
        ) : null}
      </section>

      <section className="space-y-6">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {q ? 'Search results' : 'Browse books'}
        </h2>
        {loading ? (
          <p className="text-muted-foreground text-sm leading-relaxed">Loading…</p>
        ) : error ? (
          <p className="text-destructive text-sm leading-relaxed">{error}</p>
        ) : data?.items?.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            No books match your search. Try different keywords.
          </p>
        ) : (
          <>
            <div className="library-panel overflow-hidden p-1 sm:p-2">
              <div className="library-table-wrap">
                <table className="library-data-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Author</th>
                      <th scope="col">ISBN</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((book) => (
                      <tr key={book.id}>
                        <td>
                          <Link
                            to={`/books/${book.id}`}
                            className="font-semibold tracking-tight text-slate-900 underline-offset-4 transition-colors hover:text-primary hover:underline dark:text-slate-100"
                          >
                            {book.title}
                          </Link>
                        </td>
                        <td>
                          <span className="text-sky-800 font-medium dark:text-sky-300">
                            {book.author}
                          </span>
                        </td>
                        <td className="text-muted-foreground tabular-nums">{book.isbn}</td>
                        <td className="text-muted-foreground">
                          {book.category || '—'}
                        </td>
                        <td>
                          <BorrowAvailability
                            available={book.availableCopies}
                            total={book.totalCopies}
                          />
                        </td>
                        <td className="text-right">
                          <Link
                            to={`/books/${book.id}`}
                            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                          >
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm leading-relaxed">
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
              <p className="text-muted-foreground pt-2 text-center text-sm leading-relaxed">
                {data.total} {data.total === 1 ? 'book' : 'books'} total
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
