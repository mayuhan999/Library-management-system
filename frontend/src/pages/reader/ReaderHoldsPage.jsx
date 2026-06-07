import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

function holdBadge(status) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="rounded-sm border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
          Pending
        </span>
      )
    case 'FULFILLED':
      return (
        <span className="rounded-sm border border-[#0d7a4f]/40 bg-[#ecfdf3] px-2 py-0.5 text-xs font-semibold text-[#0d7a4f]">
          Fulfilled
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="rounded-sm border border-[#d0d5dd] bg-[#f5f5f5] px-2 py-0.5 text-xs text-[#5c6b7a]">
          Cancelled
        </span>
      )
    case 'APPROVED':
      return (
        <span className="rounded-sm border border-[#175cd3]/40 bg-[#eff8ff] px-2 py-0.5 text-xs font-semibold text-[#175cd3]">
          Approved
        </span>
      )
    case 'READY':
      return (
        <span className="rounded-sm border border-[#0d7a4f]/40 bg-[#ecfdf3] px-2 py-0.5 text-xs font-semibold text-[#027a48]">
          Ready for pickup
        </span>
      )
    case 'EXPIRED':
      return (
        <span className="rounded-sm border border-[#f04438] bg-[#fef3f2] px-2 py-0.5 text-xs font-semibold text-[#b42318]">
          Expired
        </span>
      )
    default:
      return (
        <span className="rounded-sm border border-[#e5e8eb] px-2 py-0.5 text-xs text-[#1a2b3c]">{status}</span>
      )
  }
}

export function ReaderHoldsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/reader/holds')
      setItems(res.items || [])
    } catch (e) {
      setErr(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function cancelHold(id) {
    if (!window.confirm('Cancel this reservation?')) return
    try {
      await apiFetch(`/api/reader/holds/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setErr(e.message || 'Cancel failed')
    }
  }

  return (
    <div className="b-app max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">My holds</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Reservations when no copies are available; status updates here.</p>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Book</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Placed</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Status</th>
                <th className="px-3 py-2 text-right font-medium text-[#3d4f5f]">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id} className="border-b border-[#f0f2f4] hover:bg-[#fafafa]">
                  <td className="px-3 py-2.5">
                    <Link to={`/books/${h.bookId}`} className="font-medium text-[#003366] hover:underline">
                      {h.book?.title}
                    </Link>
                    <div className="text-xs text-[#5c6b7a]">{h.book?.author}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[#5c6b7a]">{new Date(h.placedAt).toLocaleString()}</td>
                  <td className="px-3 py-2.5">{holdBadge(h.status)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {['ACTIVE', 'APPROVED', 'READY'].includes(h.status) ? (
                      <Button type="button" size="sm" variant="secondary" className="mr-2" onClick={() => cancelHold(h.id)}>
                        Cancel
                      </Button>
                    ) : null}
                    <Link to={`/books/${h.bookId}`} className="text-sm font-medium text-[#003366] hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <p className="p-4 text-sm text-[#5c6b7a]">No reservations.</p> : null}
        </div>
      )}
    </div>
  )
}
