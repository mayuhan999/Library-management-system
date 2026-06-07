import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { StripedBarcode } from '@/components/StripedBarcode'
import { isbnForEan } from '@/lib/barcodeFormat'

const COPY_STATUSES = ['AVAILABLE', 'ON_LOAN', 'LOST', 'DAMAGED']

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
  const [selectedBook, setSelectedBook] = useState(null)
  const [copies, setCopies] = useState([])
  const [copyBookMeta, setCopyBookMeta] = useState(null)
  const [copiesLoading, setCopiesLoading] = useState(false)
  const [incidentNotes, setIncidentNotes] = useState('')
  const [incidentFine, setIncidentFine] = useState('')
  const [showScan, setShowScan] = useState(false)
  const [scanMsg, setScanMsg] = useState('')

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

  async function handleBarcodeScan(code) {
    setErr('')
    setScanMsg('')
    try {
      const res = await apiFetch(`/api/librarian/barcode-lookup?code=${encodeURIComponent(code)}`)
      const r = res.resolved
      if (r.kind === 'COPY' || r.kind === 'BOOK') {
        const book = r.book
        setIsbn(book.isbn)
        setApplied({ title: '', author: '', isbn: book.isbn, category: '' })
        setPage(1)
        await openCopies(book)
        setScanMsg(`Matched: ${book.title}${r.libraryBarcode ? ` (${r.libraryBarcode})` : ''}`)
      } else if (r.kind === 'ISBN') {
        setIsbn(r.isbn)
        setApplied({ title: '', author: '', isbn: r.isbn, category: '' })
        setPage(1)
        setScanMsg(`ISBN ${r.isbn} — filter applied`)
      } else {
        setErr('No catalog match for this barcode')
      }
    } catch (e) {
      setErr(e.message || 'Scan lookup failed')
    }
  }

  async function openCopies(book) {
    setSelectedBook(book)
    setCopiesLoading(true)
    setErr('')
    try {
      const res = await apiFetch(`/api/librarian/books/${book.id}/copies`)
      setCopies(res.copies || [])
      setCopyBookMeta(res.book || book)
    } catch (e) {
      setErr(e.message || 'Failed to load copies')
      setCopies([])
    } finally {
      setCopiesLoading(false)
    }
  }

  async function updateCopyStatus(copyId, status) {
    try {
      await apiFetch(`/api/librarian/copies/${copyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (selectedBook) await openCopies(selectedBook)
      await load()
    } catch (e) {
      setErr(e.message || 'Status update failed')
    }
  }

  async function recordIncident(copyId, type) {
    try {
      await apiFetch(`/api/librarian/copies/${copyId}/incident`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          notes: incidentNotes,
          fineAmount: parseFloat(incidentFine) || 0,
        }),
      })
      setIncidentNotes('')
      setIncidentFine('')
      if (selectedBook) await openCopies(selectedBook)
      await load()
    } catch (e) {
      setErr(e.message || 'Incident recording failed')
    }
  }

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
        <p className="mt-1 text-sm text-[#5c6b7a]">
          L1.04/L1.09 — Search or scan barcodes to locate copies.
        </p>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
        <Button type="button" size="sm" variant="outline" onClick={() => setShowScan((v) => !v)}>
          {showScan ? 'Hide scanner' : 'Scan barcode'}
        </Button>
        {showScan ? (
          <div className="mt-3">
            <BarcodeScanner label="Inventory lookup" onScan={handleBarcodeScan} onClose={() => setShowScan(false)} />
          </div>
        ) : null}
        {scanMsg ? <p className="mt-2 text-sm text-[#0d7a4f]">{scanMsg}</p> : null}
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
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Actions</th>
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
                    <td className="px-3 py-2">
                      <Button type="button" size="sm" variant="outline" className="mr-2" onClick={() => openCopies(b)}>
                        Copies
                      </Button>
                      <Link
                        className="text-xs font-medium text-[#003366] hover:underline"
                        to={`/librarian/books/${b.id}/labels`}
                      >
                        Labels
                      </Link>
                    </td>
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

      {selectedBook ? (
        <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1a2b3c]">
              Copies — {selectedBook.title}
            </h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedBook(null)
                setCopies([])
                setCopyBookMeta(null)
              }}
            >
              Close
            </Button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Incident notes"
              value={incidentNotes}
              onChange={(e) => setIncidentNotes(e.target.value)}
              className={inputClass}
            />
            <input
              placeholder="Fine amount (optional)"
              value={incidentFine}
              onChange={(e) => setIncidentFine(e.target.value)}
              className={inputClass}
            />
          </div>

          {copiesLoading ? (
            <p className="text-sm text-[#5c6b7a]">Loading copies…</p>
          ) : (
            <>
              {copyBookMeta && isbnForEan(copyBookMeta.isbn) ? (
                <div className="mb-4">
                  <StripedBarcode
                    value={isbnForEan(copyBookMeta.isbn)}
                    format="EAN13"
                    label="Catalog ISBN barcode"
                    height={40}
                  />
                </div>
              ) : null}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e5e8eb] text-xs text-[#5c6b7a]">
                    <th className="py-2">Striped barcode</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {copies.map((c) => (
                    <tr key={c.id} className="border-b border-[#f0f2f4] align-top">
                      <td className="py-3">
                        <StripedBarcode
                          value={c.libraryBarcode}
                          format="CODE128"
                          height={40}
                          width={1.5}
                          className="max-w-[220px]"
                        />
                      </td>
                      <td className="py-3">{c.status}</td>
                      <td className="py-3 text-right">
                      <select
                        className="mr-2 rounded-sm border border-[#e5e8eb] px-2 py-1 text-xs"
                        value={c.status}
                        onChange={(e) => updateCopyStatus(c.id, e.target.value)}
                      >
                        {COPY_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Button type="button" size="sm" variant="outline" className="mr-1" onClick={() => recordIncident(c.id, 'LOST')}>
                        Lost
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => recordIncident(c.id, 'DAMAGED')}>
                        Damaged
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
