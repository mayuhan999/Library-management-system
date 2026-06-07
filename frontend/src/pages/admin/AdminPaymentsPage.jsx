import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

export function AdminPaymentsPage() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const qs = new URLSearchParams({ limit: '50' })
      if (status) qs.set('status', status)
      const res = await apiFetch(`/api/admin/payments?${qs}`)
      setData(res)
    } catch (e) {
      setErr(e.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Payment reconciliation</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">A1.10 — Alipay sandbox fine payment ledger.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
        </select>
        <Button type="button" variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {data?.summary?.length ? (
        <div className="flex flex-wrap gap-3">
          {data.summary.map((s) => (
            <div key={s.status} className="rounded-sm border border-[#e5e8eb] bg-white px-4 py-3 text-sm">
              <span className="font-medium">{s.status}</span>: {s.count} · ${s.amount.toFixed(2)}
            </div>
          ))}
        </div>
      ) : null}

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Reader</th>
                <th className="px-3 py-2">Book</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Out trade no</th>
                <th className="px-3 py-2">Trade no</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((p) => (
                <tr key={p.id} className="border-b border-[#f0f2f4]">
                  <td className="px-3 py-2 text-xs text-[#5c6b7a]">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div>{p.user?.fullName}</div>
                    <div className="text-xs text-[#5c6b7a]">{p.user?.email}</div>
                  </td>
                  <td className="px-3 py-2">{p.loan?.book?.title || '—'}</td>
                  <td className="px-3 py-2 font-medium">${p.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                        p.status === 'SUCCESS'
                          ? 'bg-[#ecfdf3] text-[#027a48]'
                          : p.status === 'PENDING'
                            ? 'bg-[#fff4e5] text-[#b54708]'
                            : 'bg-[#f5f5f5] text-[#5c6b7a]'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.outTradeNo}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.tradeNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.items?.length ? <p className="p-4 text-sm text-[#5c6b7a]">No payment records.</p> : null}
        </div>
      )}
    </div>
  )
}
