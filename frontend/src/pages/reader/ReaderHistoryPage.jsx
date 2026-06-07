import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

export function ReaderHistoryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/reader/loans/history')
      setItems(res.items || [])
    } catch (e) {
      setErr(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="b-app max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Borrowing history</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">All your past and current loans.</p>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}

      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Book</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Borrowed</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Due</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Returned</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Fine</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Status</th>
                <th className="px-3 py-2 text-right font-medium text-[#3d4f5f]">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-[#5c6b7a]">
                    No borrowing history yet.
                  </td>
                </tr>
              ) : (
                items.map((loan) => {
                  const overdue = loan.status === 'BORROWED' && new Date(loan.dueAt) < new Date()
                  return (
                    <tr
                      key={loan.id}
                      className={['border-b border-[#f0f2f4]', overdue ? 'bg-[#fef3f2]' : 'hover:bg-[#fafafa]'].join(' ')}
                    >
                      <td className="px-3 py-2.5">
                        <Link to={`/books/${loan.bookId}`} className="font-medium text-[#003366] hover:underline">
                          {loan.book?.title}
                        </Link>
                        <div className="text-xs text-[#5c6b7a]">{loan.book?.author}</div>
                        {loan.bookCopy?.libraryBarcode ? (
                          <div className="mt-0.5 font-mono text-[10px] text-[#5c6b7a]">
                            {loan.bookCopy.libraryBarcode}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-[#5c6b7a]">
                        {new Date(loan.borrowedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">{new Date(loan.dueAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 text-[#5c6b7a]">
                        {loan.returnedAt ? new Date(loan.returnedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {loan.fineAmount > 0 ? (
                          <span className="text-[#b42318]">${loan.fineAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-[#5c6b7a]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {overdue ? (
                          <span className="rounded-sm border border-[#f04438] bg-[#fef3f2] px-2 py-0.5 text-xs font-semibold text-[#b42318]">
                            Overdue
                          </span>
                        ) : loan.status === 'RETURNED' ? (
                          <span className="rounded-sm border border-[#d0d5dd] bg-[#f5f5f5] px-2 py-0.5 text-xs text-[#5c6b7a]">
                            Returned
                          </span>
                        ) : (
                          <span className="rounded-sm border border-[#0d7a4f]/40 bg-[#ecfdf3] px-2 py-0.5 text-xs font-semibold text-[#0d7a4f]">
                            On loan
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link to={`/books/${loan.bookId}`}>
                          <Button type="button" size="sm" variant="outline">
                            Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
