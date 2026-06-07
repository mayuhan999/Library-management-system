import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { StripedBarcode } from '@/components/StripedBarcode'
import { isbnForEan } from '@/lib/barcodeFormat'

function CopyLabel({ book, copy }) {
  const catalogCode = book.barcode || book.isbn

  return (
    <div className="flex flex-col gap-3 rounded-sm border-2 border-[#1a2b3c] bg-white p-4 print:break-inside-avoid">
      <div>
        <p className="max-w-[240px] text-sm font-semibold leading-snug text-[#1a2b3c]">{book.title}</p>
        <p className="mt-0.5 max-w-[240px] text-xs text-[#5c6b7a]">{book.author}</p>
      </div>

      {isbnForEan(book.isbn) ? (
        <StripedBarcode
          value={isbnForEan(book.isbn)}
          format="EAN13"
          label="Catalog ISBN (EAN-13)"
          height={44}
        />
      ) : (
        <StripedBarcode value={catalogCode} label="Catalog barcode" height={44} />
      )}

      <StripedBarcode
        value={copy.libraryBarcode}
        format="CODE128"
        label="Library copy (scan at desk)"
        height={56}
      />

      <p className="font-mono text-[10px] text-[#5c6b7a]">Status: {copy.status}</p>
    </div>
  )
}

export function LibrarianBookLabelsPage() {
  const { bookId } = useParams()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setErr('')
      try {
        const res = await apiFetch(`/api/librarian/books/${bookId}/copies`)
        if (!cancelled) setData(res)
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [bookId])

  return (
    <div className="b-app max-w-5xl space-y-6 print:max-w-none">
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-[#003366]">Barcode labels</h1>
          <p className="mt-1 text-sm text-[#5c6b7a]">
            Black-and-white striped barcodes (EAN-13 for ISBN, Code128 for each copy LIB…). Print and attach to books.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print labels
          </Button>
          <Link
            to="/librarian/inventory"
            className="inline-flex h-9 items-center rounded-sm border border-[#e5e8eb] bg-white px-3 text-sm font-medium text-[#003366] hover:bg-[#f5f5f5]"
          >
            Inventory
          </Link>
        </div>
      </div>

      {loading ? <p className="text-sm text-[#5c6b7a]">Loading…</p> : null}
      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}

      {data?.book && data.copies?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          {data.copies.map((c) => (
            <CopyLabel key={c.id} book={data.book} copy={c} />
          ))}
        </div>
      ) : null}

      {!loading && !err && data?.copies?.length === 0 ? (
        <p className="text-sm text-[#5c6b7a]">No copies found for this title.</p>
      ) : null}
    </div>
  )
}
