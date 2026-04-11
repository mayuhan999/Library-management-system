import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BorrowAvailability } from '@/components/BorrowAvailability'
import { apiFetch } from '@/api/http'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function BookDetailPage() {
  const { id } = useParams()
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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
          setError(
            err.status === 404 ? 'Book not found' : err.message || 'Failed to load',
          )
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

  if (loading) {
    return (
      <p className="text-muted-foreground library-app py-16 text-center text-sm leading-relaxed">
        Loading…
      </p>
    )
  }

  if (error || !book) {
    return (
      <div className="library-app library-panel space-y-6 p-8 sm:p-10">
        <p className="text-destructive font-medium leading-relaxed">{error || 'Book not found'}</p>
        <Link
          to="/books"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex')}
        >
          Back to catalog
        </Link>
      </div>
    )
  }

  return (
    <article className="library-app max-w-2xl space-y-10">
      <div className="space-y-4">
        <Link
          to="/books"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 mb-1 inline-flex text-primary hover:text-primary/90',
          )}
        >
          ← Back to catalog
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {book.title}
        </h1>
        <p className="text-sky-800 dark:text-sky-300 text-xl font-medium leading-relaxed">
          {book.author}
        </p>
      </div>

      <dl className="library-panel grid gap-x-6 gap-y-5 p-6 text-sm sm:grid-cols-2 sm:p-8">
        <div>
          <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            ISBN
          </dt>
          <dd className="text-foreground mt-1.5 tabular-nums">{book.isbn}</dd>
        </div>
        {book.category ? (
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Category
            </dt>
            <dd className="text-foreground mt-1.5">{book.category}</dd>
          </div>
        ) : null}
        {book.publisher ? (
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Publisher
            </dt>
            <dd className="text-foreground mt-1.5">{book.publisher}</dd>
          </div>
        ) : null}
        {book.publishedYear != null ? (
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Year
            </dt>
            <dd className="text-foreground mt-1.5">{book.publishedYear}</dd>
          </div>
        ) : null}
        {book.language ? (
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Language
            </dt>
            <dd className="text-foreground mt-1.5">{book.language}</dd>
          </div>
        ) : null}
        {book.shelfLocation ? (
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Shelf
            </dt>
            <dd className="text-foreground mt-1.5">{book.shelfLocation}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Holdings
          </dt>
          <dd className="mt-2 text-base leading-relaxed">
            <BorrowAvailability
              available={book.availableCopies}
              total={book.totalCopies}
              detailed
            />
          </dd>
        </div>
      </dl>

      {book.description ? (
        <section className="library-panel space-y-4 p-6 sm:p-8">
          <h2 className="text-foreground text-base font-semibold tracking-tight">Description</h2>
          <p className="text-foreground/90 text-base leading-loose">{book.description}</p>
        </section>
      ) : (
        <p className="text-muted-foreground library-panel px-6 py-5 text-sm leading-relaxed sm:px-8">
          No description available.
        </p>
      )}
    </article>
  )
}
