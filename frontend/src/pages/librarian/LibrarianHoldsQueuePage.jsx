import { useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

export function LibrarianHoldsQueuePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/librarian/holds-queue')
      setItems(res.items || [])
    } catch (e) {
      setErr(e.message || 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function updateHold(id, status) {
    try {
      await apiFetch(`/api/librarian/holds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (e) {
      setErr(e.message || 'Update failed')
    }
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Hold queue</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Active reservations, oldest first.</p>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Placed</th>
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
                    <div className="font-medium">{h.user?.fullName}</div>
                    <div className="text-xs text-[#5c6b7a]">{h.user?.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div>{h.book?.title}</div>
                    <div className="text-xs text-[#5c6b7a]">{h.book?.isbn}</div>
                  </td>
                  <td className="px-3 py-2.5">{h.book?.availableCopies}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button type="button" size="sm" variant="outline" className="mr-2" onClick={() => updateHold(h.id, 'FULFILLED')}>
                      Fulfilled
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => updateHold(h.id, 'CANCELLED')}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <p className="p-4 text-sm text-[#5c6b7a]">No active holds.</p> : null}
        </div>
      )}
    </div>
  )
}
