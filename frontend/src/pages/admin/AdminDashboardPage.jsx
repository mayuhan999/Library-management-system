import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
      <p className="text-xs text-[#5c6b7a]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#003366]">{value}</p>
      {sub ? <p className="mt-1 text-[10px] text-[#8a96a3]">{sub}</p> : null}
    </div>
  )
}

export function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/admin/dashboard')
      setData(res)
    } catch (e) {
      setErr(e.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const s = data?.summary

  return (
    <div className="b-app space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#003366]">Global dashboard</h1>
          <p className="mt-1 text-sm text-[#5c6b7a]">A1.11 — Collection, circulation, fines, and Alipay revenue.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? <p className="text-sm text-[#5c6b7a]">Loading…</p> : null}

      {s ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Titles" value={s.totalBooks} sub={`${s.totalCopies} copies · ${s.availableCopies} available`} />
            <StatCard label="Readers" value={s.readers} sub={`${s.totalUsers} total users`} />
            <StatCard label="Active loans" value={s.activeLoans} sub={`${s.overdueLoans} overdue`} />
            <StatCard label="Fine revenue (paid)" value={`$${s.fineRevenuePaid.toFixed(2)}`} sub={`$${s.fineRevenueUnpaid.toFixed(2)} unpaid`} />
            <StatCard label="Alipay collected" value={`$${s.alipayRevenueTotal.toFixed(2)}`} sub={`${s.alipayPaymentsToday} payments today`} />
            <StatCard label="Pending payments" value={s.pendingPayments} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Circulation (7 days)</h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e8eb] text-left text-xs text-[#5c6b7a]">
                    <th className="py-2">Date</th>
                    <th className="py-2">Borrows</th>
                    <th className="py-2">Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.circulationTrend || []).map((row) => (
                    <tr key={row.date} className="border-b border-[#f0f2f4]">
                      <td className="py-2">{row.date}</td>
                      <td className="py-2">{row.borrows}</td>
                      <td className="py-2">{row.returns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
              <h2 className="text-sm font-semibold text-[#1a2b3c]">Collection by category</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {(data.categoryBreakdown || []).map((c) => (
                  <li key={c.category} className="flex justify-between border-b border-[#f0f2f4] py-2">
                    <span>{c.category}</span>
                    <span className="font-medium">{c.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
