import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

function StatCard({ label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-[#003366]',
    warn: 'text-[#b54708]',
    danger: 'text-[#b42318]',
    ok: 'text-[#027a48]',
  }
  return (
    <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
      <p className="text-xs text-[#5c6b7a]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tones[tone] || tones.default}`}>{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-[#8a96a3]">{hint}</p> : null}
    </div>
  )
}

export function LibrarianDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/librarian/dashboard')
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
          <h1 className="text-lg font-semibold text-[#003366]">Circulation dashboard</h1>
          <p className="mt-1 text-sm text-[#5c6b7a]">L1.11 — Today&apos;s desk activity and queue overview.</p>
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
            <StatCard label="Checkouts today" value={s.todayCheckouts} />
            <StatCard label="Returns today" value={s.todayReturns} tone="ok" />
            <StatCard label="Active loans" value={s.activeLoans} />
            <StatCard label="Overdue" value={s.overdueLoans} tone="danger" />
            <StatCard label="Holds pending" value={s.pendingHolds} tone="warn" />
            <StatCard label="Ready for pickup" value={s.readyHolds} tone="ok" />
            <StatCard label="Incidents (30d)" value={s.incidentsLast30Days} />
          </div>

          <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#1a2b3c]">Recent activity</h2>
            {data.recentActivity?.length ? (
              <ul className="mt-3 divide-y divide-[#f0f2f4] text-sm">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex justify-between py-2">
                    <span>
                      <span className="font-medium">{a.action}</span> · {a.entityType}
                      {a.actor ? ` — ${a.actor}` : ''}
                    </span>
                    <span className="text-xs text-[#5c6b7a]">{new Date(a.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#5c6b7a]">No recent activity.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
