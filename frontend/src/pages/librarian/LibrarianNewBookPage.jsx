import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { StripedBarcode } from '@/components/StripedBarcode'
import { isbnForEan } from '@/lib/barcodeFormat'

export function LibrarianNewBookPage() {
  const [isbn, setIsbn] = useState('')
  const [barcode, setBarcode] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [publisher, setPublisher] = useState('')
  const [publishedYear, setPublishedYear] = useState('')
  const [category, setCategory] = useState('')
  const [language, setLanguage] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [totalCopies, setTotalCopies] = useState('1')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [lookupHint, setLookupHint] = useState('')
  const [pending, setPending] = useState(false)
  const [lookupPending, setLookupPending] = useState(false)
  const [lastAddedBookId, setLastAddedBookId] = useState(null)
  const [showScan, setShowScan] = useState(false)

  async function handleLookup(fromScan = false) {
    setErr('')
    setLookupHint('')
    setLookupPending(true)
    try {
      const qs = new URLSearchParams({ isbn: isbn.trim() })
      const meta = await apiFetch(`/api/librarian/isbn-lookup?${qs}`)
      if (meta.title) setTitle(meta.title)
      if (meta.authors) setAuthor(meta.authors)
      if (meta.publisher) setPublisher(meta.publisher)
      if (meta.publishedYear != null) setPublishedYear(String(meta.publishedYear))
      if (meta.language) setLanguage(meta.language)
      if (meta.coverImageUrl) setCoverImageUrl(meta.coverImageUrl)
      if (meta.description) setDescription(meta.description)
      if (meta.subjects?.[0] && !category.trim()) setCategory(meta.subjects[0])
      if (!barcode.trim() && meta.isbn) setBarcode(meta.isbn)
      setLookupHint(fromScan ? 'ISBN scanned — metadata filled from Open Library.' : 'Metadata loaded from Open Library.')
    } catch (e2) {
      setLookupHint('API unavailable — please enter book details manually.')
      if (!fromScan) setErr(e2.message || 'Lookup failed')
    } finally {
      setLookupPending(false)
    }
  }

  function onIsbnBlur() {
    if (isbn.trim().length >= 10 && !title.trim()) {
      handleLookup(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('')
    setErr('')
    setLastAddedBookId(null)
    setPending(true)
    try {
      const body = {
        isbn,
        barcode: barcode.trim() || undefined,
        title,
        author,
        category: category || undefined,
        totalCopies: parseInt(totalCopies, 10) || 1,
        publisher: publisher || undefined,
        publishedYear: (() => {
          if (!publishedYear.trim()) return undefined
          const p = parseInt(publishedYear, 10)
          return Number.isFinite(p) ? p : undefined
        })(),
        language: language || undefined,
        description: description || undefined,
        coverImageUrl: coverImageUrl || undefined,
      }
      const res = await apiFetch('/api/librarian/books', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const copyCount = res.copies?.length ?? 0
      setMsg(`Book added with ${copyCount} copy barcode(s). Catalog barcode: ${res.book?.barcode || isbn}.`)
      setLastAddedBookId(res.book?.id || null)
      setIsbn('')
      setBarcode('')
      setTitle('')
      setAuthor('')
      setPublisher('')
      setPublishedYear('')
      setCategory('')
      setLanguage('')
      setDescription('')
      setCoverImageUrl('')
      setTotalCopies('1')
      setLookupHint('')
    } catch (e2) {
      setErr(e2.message || 'Failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="b-app max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Add book</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          L1.10 — Scan or enter ISBN for Open Library auto-fill; manual entry if the API fails.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-[#e5e8eb] bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">ISBN</label>
          <div className="flex flex-wrap gap-2">
            <input
              required
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onBlur={onIsbnBlur}
              className={`${inputClass} min-w-[12rem] flex-1`}
            />
            <Button type="button" variant="outline" disabled={lookupPending || !isbn.trim()} onClick={() => handleLookup(false)}>
              {lookupPending ? 'Looking up…' : 'Look up ISBN'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowScan((v) => !v)}>
              {showScan ? 'Hide scan' : 'Scan ISBN'}
            </Button>
          </div>
          {showScan ? (
            <div className="mt-2">
              <BarcodeScanner
                label="ISBN / barcode scan"
                onScan={(code) => {
                  setIsbn(code.replace(/[-\s]/g, ''))
                  setShowScan(false)
                  handleLookup(true)
                }}
                onClose={() => setShowScan(false)}
              />
            </div>
          ) : null}
          {lookupHint ? <p className="mt-1 text-xs text-[#5c6b7a]">{lookupHint}</p> : null}
          {isbnForEan(isbn) ? (
            <div className="mt-3">
              <StripedBarcode
                value={isbnForEan(isbn)}
                format="EAN13"
                label="ISBN barcode preview (EAN-13 stripes)"
                height={48}
              />
            </div>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Catalog barcode (optional)</label>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className={`${inputClass} font-mono text-sm`}
            placeholder="Defaults to ISBN digits"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Author</label>
          <input required value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Publisher (optional)</label>
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Year (optional)</label>
            <input value={publishedYear} onChange={(e) => setPublishedYear(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Category (optional)</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Language (optional)</label>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Cover URL (optional)</label>
          <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3d4f5f]">Copies</label>
          <input type="number" min={1} value={totalCopies} onChange={(e) => setTotalCopies(e.target.value)} className={inputClass} />
        </div>
        {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
        {msg ? <p className="text-sm text-[#0d7a4f]">{msg}</p> : null}
        {lastAddedBookId ? (
          <p className="text-sm">
            <Link to={`/librarian/books/${lastAddedBookId}/labels`} className="font-medium text-[#003366] underline underline-offset-2">
              Print striped barcode labels (ISBN + LIB copies)
            </Link>
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add to catalog'}
        </Button>
      </form>
    </div>
  )
}
