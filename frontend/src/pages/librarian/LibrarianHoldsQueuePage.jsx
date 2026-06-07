import { useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

const STATUS_FILTER = ['', 'ACTIVE', 'APPROVED', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED']

export function LibrarianHoldsQueuePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewAll, setViewAll] = useState(false)

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const path = viewAll
        ? `/api/librarian/holds${statusFilter ? `?status=${statusFilter}` : ''}`
        : '/api/librarian/holds-queue'
      const res = await apiFetch(path)
      setItems(res.items || [])
    } catch (e) {
      setErr(e.message || 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [viewAll, statusFilter])

  async function updateHold(id, action) {
    const body = { action }
    if (action === 'CANCEL') {
      const reason = window.prompt('Cancellation reason (optional)') || ''
      body.cancelReason = reason
    }
    try {
      await apiFetch(`/api/librarian/holds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await load()
    } catch (e) {
      setErr(e.message || 'Update failed')
    }
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Reservation management</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          L1.07 — Approve, cancel, confirm arrival. L1.08 — Readers notified when books are ready.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={viewAll ? 'secondary' : 'default'} onClick={() => setViewAll(false)}>
          Active queue
        </Button>
        <Button type="button" variant={viewAll ? 'default' : 'secondary'} onClick={() => setViewAll(true)}>
          All orders
        </Button>
        {viewAll ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass}
          >
            {STATUS_FILTER.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Placed</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Status</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Patron</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Book</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Copies avail.</th>
                <th className="px-3 py-2 text-right font-medium text-[#3d4f5f]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => (
                <tr key={h.id} className="border-b border-[#f0f2f4] hover:bg-[#fafafa]">
                  <td className="px-3 py-2.5 text-[#5c6b7a]">{new Date(h.placedAt).toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-sm bg-[#e8eef4] px-2 py-0.5 text-xs font-medium text-[#003366]">
                      {h.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{h.user?.fullName}</div>
                    <div className="text-xs text-[#5c6b7a]">{h.user?.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div>{h.book?.title}</div>
                    <div className="text-xs text-[#5c6b7a]">{h.book?.isbn}</div>
                  </td>
                  <td className="px-3 py-2.5">{h.book?.availableCopies}</td>
                  <td className="px-3 py-2.5 text-right">
                    {h.status === 'ACTIVE' ? (
                      <Button type="button" size="sm" variant="outline" className="mr-1" onClick={() => updateHold(h.id, 'APPROVE')}>
                        Approve
                      </Button>
                    ) : null}
                    {['ACTIVE', 'APPROVED'].includes(h.status) && (h.book?.availableCopies ?? 0) > 0 ? (
                      <Button type="button" size="sm" className="mr-1" onClick={() => updateHold(h.id, 'READY')}>
                        Confirm arrival
                      </Button>
                    ) : null}
                    {['ACTIVE', 'APPROVED', 'READY'].includes(h.status) ? (
                      <>
                        <Button type="button" size="sm" variant="outline" className="mr-1" onClick={() => updateHold(h.id, 'FULFILL')}>
                          Picked up
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => updateHold(h.id, 'CANCEL')}>
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <p className="p-4 text-sm text-[#5c6b7a]">No reservations found.</p> : null}
        </div>
      )}
    </div>
  )
}
