import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

const healthUrl = `${import.meta.env.VITE_API_BASE || ''}/health`

export function AdminSystemPage() {
  const [health, setHealth] = useState(null)
  const [healthErr, setHealthErr] = useState('')
  const [dbStatus, setDbStatus] = useState(null)
  const [dbErr, setDbErr] = useState('')
  const [bootMsg, setBootMsg] = useState('')
  const [bootErr, setBootErr] = useState('')
  const [bootPending, setBootPending] = useState(false)

  const loadDb = useCallback(async () => {
    setDbErr('')
    try {
      const res = await apiFetch('/api/admin/database-status')
      setDbStatus(res)
    } catch (e) {
      setDbStatus(null)
      setDbErr(e.message || 'Cannot reach database')
    }
  }, [])

  useEffect(() => {
    fetch(healthUrl)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealthErr('Cannot reach API'))
  }, [])

  useEffect(() => {
    loadDb()
  }, [loadDb])

  async function runBootstrap() {
    setBootMsg('')
    setBootErr('')
    setBootPending(true)
    try {
      await apiFetch('/api/admin/database-bootstrap', { method: 'POST', body: JSON.stringify({}) })
      setBootMsg('Default configuration keys have been written (created if missing).')
      await loadDb()
    } catch (e) {
      setBootErr(e.message || 'Bootstrap failed')
    } finally {
      setBootPending(false)
    }
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">System & database</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Check API health, verify the database connection, and seed default loan rules.</p>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">API health</h2>
        {healthErr ? <p className="mt-2 text-sm text-[#b42318]">{healthErr}</p> : null}
        {health ? (
          <pre className="mt-3 overflow-x-auto rounded-sm border border-[#e5e8eb] bg-[#f5f5f5] p-3 font-mono text-xs text-[#1a2b3c]">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : !healthErr ? (
          <p className="mt-2 text-sm text-[#5c6b7a]">Checking…</p>
        ) : null}
        <p className="mt-3 text-xs text-[#5c6b7a]">
          Set <code className="rounded bg-[#f5f5f5] px-1">VITE_API_BASE</code> for production; dev proxies{' '}
          <code className="rounded bg-[#f5f5f5] px-1">/api</code> to the backend.
        </p>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Database status</h2>
        <p className="mt-1 text-xs text-[#5c6b7a]">
          Run Prisma migrations on the server for first deploy. This view confirms connectivity and row counts.
        </p>
        {dbErr ? <p className="mt-2 text-sm text-[#b42318]">{dbErr}</p> : null}
        {dbStatus?.ok ? (
          <ul className="mt-3 space-y-1 text-sm text-[#1a2b3c]">
            <li>
              Connection: <span className="font-semibold text-[#0d7a4f]">OK</span>
            </li>
            <li>Users: {dbStatus.counts?.users ?? '—'}</li>
            <li>Books: {dbStatus.counts?.books ?? '—'}</li>
            <li>Loans: {dbStatus.counts?.loans ?? '—'}</li>
            <li>Holds: {dbStatus.counts?.holds ?? '—'}</li>
            <li>Config rows: {dbStatus.counts?.configRows ?? '—'}</li>
          </ul>
        ) : !dbErr ? (
          <p className="mt-2 text-sm text-[#5c6b7a]">Loading…</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => loadDb()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Default rules bootstrap</h2>
        <p className="mt-1 text-xs text-[#5c6b7a]">
          Upsert default config keys (loan days, password length, max loans, etc.) without wiping data. For a full reset use{' '}
          <code className="rounded bg-[#f5f5f5] px-1">npm run seed</code> in the backend.
        </p>
        {bootErr ? <p className="mt-2 text-sm text-[#b42318]">{bootErr}</p> : null}
        {bootMsg ? <p className="mt-2 text-sm text-[#0d7a4f]">{bootMsg}</p> : null}
        <div className="mt-4">
          <Button type="button" disabled={bootPending} onClick={runBootstrap}>
            {bootPending ? 'Working…' : 'Write default config'}
          </Button>
        </div>
      </div>
    </div>
  )
}
