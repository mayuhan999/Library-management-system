import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

export function LibrarianInventoryPage() {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [category, setCategory] = useState('')
  const [applied, setApplied] = useState({ title: '', author: '', isbn: '', category: '' })
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '20' })
      if (applied.title) qs.set('title', applied.title)
      if (applied.author) qs.set('author', applied.author)
      if (applied.isbn) qs.set('isbn', applied.isbn)
      if (applied.category) qs.set('category', applied.category)
      const res = await apiFetch(`/api/books?${qs}`)
      setData(res)
    } catch (e) {
      setErr(e.message || 'Failed')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, applied])

  useEffect(() => {
    load()
  }, [load])

  function applyFilter(e) {
    e.preventDefault()
    setApplied({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      category: category.trim(),
    })
    setPage(1)
  }

  function clearFilters() {
    setTitle('')
    setAuthor('')
    setIsbn('')
    setCategory('')
    setApplied({ title: '', author: '', isbn: '', category: '' })
    setPage(1)
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Inventory</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Search catalog records and available copies.</p>
      </div>

      <form onSubmit={applyFilter} className="rounded-sm border border-[#e5e8eb] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-[#5c6b7a]">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5c6b7a]">Author</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5c6b7a]">ISBN</label>
            <input value={isbn} onChange={(e) => setIsbn(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5c6b7a]">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </form>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : data ? (
        <>
          <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Title</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Author</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">ISBN</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Available</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id} className="border-b border-[#f0f2f4] hover:bg-[#fafafa]">
                    <td className="px-3 py-2">
                      <Link className="font-medium text-[#003366] hover:underline" to={`/books/${b.id}`}>
                        {b.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{b.author}</td>
                    <td className="px-3 py-2 font-mono text-xs">{b.isbn}</td>
                    <td className="px-3 py-2">{b.availableCopies}</td>
                    <td className="px-3 py-2">{b.totalCopies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-[#5c6b7a]">
                {page} / {data.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
