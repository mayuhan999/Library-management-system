import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BorrowAvailability } from '@/components/BorrowAvailability'
import { apiFetch } from '@/api/http'
import { useAuth } from '@/context/AuthContext'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function BookDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [actionPending, setActionPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const b = await apiFetch(`/api/books/${id}`)
        if (!cancelled) setBook(b)
      } catch (err) {
        if (!cancelled) {
          setError(err.status === 404 ? 'Book not found' : err.message || 'Failed to load')
          setBook(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id])

  async function reloadBook() {
    const b = await apiFetch(`/api/books/${id}`)
    setBook(b)
  }

  async function handleBorrow() {
    setActionMsg('')
    setActionErr('')
    setActionPending(true)
    try {
      await apiFetch('/api/loans/borrow', {
        method: 'POST',
        body: JSON.stringify({ bookId: book.id }),
      })
      setActionMsg('Borrow successful. Please return by the due date.')
      await reloadBook()
    } catch (err) {
      setActionErr(err.message || 'Borrow failed')
    } finally {
      setActionPending(false)
    }
  }

  async function handleHold() {
    setActionMsg('')
    setActionErr('')
    setActionPending(true)
    try {
      await apiFetch('/api/holds', {
        method: 'POST',
        body: JSON.stringify({ bookId: book.id }),
      })
      setActionMsg('Hold placed. You will be notified when a copy is available.')
    } catch (err) {
      setActionErr(err.message || 'Hold failed')
    } finally {
      setActionPending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#5c6b7a]">
        <span className="inline-flex items-center gap-2">
          <span
            className="size-4 animate-spin rounded-full border-2 border-[#003366] border-t-transparent"
            aria-hidden
          />
          Loading…
        </span>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="max-w-xl space-y-4 rounded-sm border border-[#e5e8eb] bg-white p-6">
        <p className="text-sm font-medium text-[#b42318]">{error || 'Book not found'}</p>
        <Link to="/books" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex')}>
          Back to catalog
        </Link>
      </div>
    )
  }

  const canBorrow = book.availableCopies > 0

  return (
    <article className="max-w-3xl space-y-6">
      <div>
        <Link
          to="/books"
          className="inline-flex rounded-sm border border-[#d0d5dd] bg-white px-2.5 py-1 text-xs font-medium text-[#003366] shadow-sm hover:bg-[#f5f5f5]"
        >
          ← Back to catalog
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#003366]">{book.title}</h1>
        <p className="mt-1 text-lg text-[#1a2b3c]">{book.author}</p>
      </div>

      <dl className="grid gap-4 rounded-sm border border-[#e5e8eb] bg-white p-5 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[#5c6b7a]">Book ID (for desk checkout)</dt>
          <dd className="mt-1 font-mono text-xs text-[#1a2b3c]">{book.id}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[#5c6b7a]">ISBN</dt>
          <dd className="mt-1 tabular-nums text-[#1a2b3c]">{book.isbn}</dd>
        </div>
        {book.category ? (
          <div>
            <dt className="text-xs font-medium text-[#5c6b7a]">Category</dt>
            <dd className="mt-1 text-[#1a2b3c]">{book.category}</dd>
          </div>
        ) : null}
        {book.publisher ? (
          <div>
            <dt className="text-xs font-medium text-[#5c6b7a]">Publisher</dt>
            <dd className="mt-1 text-[#1a2b3c]">{book.publisher}</dd>
          </div>
        ) : null}
        {book.publishedYear != null ? (
          <div>
            <dt className="text-xs font-medium text-[#5c6b7a]">Year</dt>
            <dd className="mt-1 text-[#1a2b3c]">{book.publishedYear}</dd>
          </div>
        ) : null}
        {book.language ? (
          <div>
            <dt className="text-xs font-medium text-[#5c6b7a]">Language</dt>
            <dd className="mt-1 text-[#1a2b3c]">{book.language}</dd>
          </div>
        ) : null}
        {book.shelfLocation ? (
          <div>
            <dt className="text-xs font-medium text-[#5c6b7a]">Shelf</dt>
            <dd className="mt-1 text-[#1a2b3c]">{book.shelfLocation}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-[#5c6b7a]">Availability</dt>
          <dd className="mt-2">
            <BorrowAvailability available={book.availableCopies} total={book.totalCopies} detailed />
          </dd>
        </div>
      </dl>

      {user?.role === 'MEMBER' ? (
        <section className="rounded-sm border border-[#003366]/25 bg-[#f8fafc] p-5">
          <h2 className="text-sm font-semibold text-[#003366]">Reader actions</h2>
          <p className="mt-1 text-xs text-[#5c6b7a]">Borrow when copies are available; place a hold when none are available.</p>
          {actionErr ? (
            <p className="mt-3 text-sm text-[#b42318]" role="alert">
              {actionErr}
            </p>
          ) : null}
          {actionMsg ? <p className="mt-3 text-sm font-medium text-[#0d7a4f]">{actionMsg}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" disabled={actionPending || !canBorrow} onClick={handleBorrow}>
              {!canBorrow ? 'Unavailable' : 'Borrow online'}
            </Button>
            <Button type="button" variant="secondary" disabled={actionPending || canBorrow} onClick={handleHold}>
              {canBorrow ? 'Use borrow when in stock' : 'Place hold'}
            </Button>
          </div>
        </section>
      ) : null}

      {book.description ? (
        <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1a2b3c]">Description</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#1a2b3c]">{book.description}</p>
        </section>
      ) : (
        <p className="rounded-sm border border-[#e5e8eb] bg-white px-5 py-4 text-sm text-[#5c6b7a]">No description.</p>
      )}
    </article>
  )
}
