import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

const healthUrl = `${import.meta.env.VITE_API_BASE || ''}/health`

export function AdminSystemPage() {
  const [health, setHealth] = useState(null)
  const [healthErr, setHealthErr] = useState('')
  const [dbStatus, setDbStatus] = useState(null)
  const [dbErr, setDbErr] = useState('')
  const [bootMsg, setBootMsg] = useState('')
  const [bootErr, setBootErr] = useState('')
  const [bootPending, setBootPending] = useState(false)
  const [backups, setBackups] = useState([])
  const [backupMsg, setBackupMsg] = useState('')
  const [backupErr, setBackupErr] = useState('')
  const [restoreFile, setRestoreFile] = useState('')
  const [restorePending, setRestorePending] = useState(false)

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

  const loadBackups = useCallback(async () => {
    setBackupErr('')
    try {
      const res = await apiFetch('/api/admin/database/backups')
      setBackups(res.items || [])
    } catch (e) {
      setBackupErr(e.message || 'Cannot list backups')
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
    loadBackups()
  }, [loadDb, loadBackups])

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

  async function runBackup() {
    setBackupMsg('')
    setBackupErr('')
    try {
      const res = await apiFetch('/api/admin/database/backup', { method: 'POST', body: JSON.stringify({}) })
      setBackupMsg(`Backup created: ${res.backup?.filename}`)
      await loadBackups()
    } catch (e) {
      setBackupErr(e.message || 'Backup failed')
    }
  }

  async function runRestore() {
    if (!restoreFile) {
      setBackupErr('Select a backup file')
      return
    }
    if (!window.confirm(`Restore from "${restoreFile}"? This overwrites the live database.`)) return

    setBackupMsg('')
    setBackupErr('')
    setRestorePending(true)
    try {
      await apiFetch('/api/admin/database/restore', {
        method: 'POST',
        body: JSON.stringify({ filename: restoreFile, confirm: true }),
      })
      setBackupMsg(`Database restored from ${restoreFile}. Refresh counts below.`)
      await loadDb()
    } catch (e) {
      setBackupErr(e.message || 'Restore failed')
    } finally {
      setRestorePending(false)
    }
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">System & database</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          A1.09 — Manual backup, scheduled auto-backup (configure on Loan rules), and restore.
        </p>
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
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Database status</h2>
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
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Database backup & restore</h2>
        <p className="mt-1 text-xs text-[#5c6b7a]">
          Backups are stored server-side. Enable auto-backup via{' '}
          <code className="rounded bg-[#f5f5f5] px-1">AUTO_BACKUP_ENABLED</code> on Loan rules.
        </p>
        {backupErr ? <p className="mt-2 text-sm text-[#b42318]">{backupErr}</p> : null}
        {backupMsg ? <p className="mt-2 text-sm text-[#0d7a4f]">{backupMsg}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={runBackup}>
            Create backup now
          </Button>
          <Button type="button" variant="secondary" onClick={loadBackups}>
            Refresh list
          </Button>
        </div>
        {backups.length > 0 ? (
          <div className="mt-4 space-y-3">
            <select
              value={restoreFile}
              onChange={(e) => setRestoreFile(e.target.value)}
              className={inputClass}
            >
              <option value="">Select backup to restore…</option>
              {backups.map((b) => (
                <option key={b.filename} value={b.filename}>
                  {b.filename} ({Math.round(b.sizeBytes / 1024)} KB, {new Date(b.createdAt).toLocaleString()})
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" disabled={restorePending} onClick={runRestore}>
              {restorePending ? 'Restoring…' : 'Restore selected backup'}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#5c6b7a]">No backups yet.</p>
        )}
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Default rules bootstrap</h2>
        <p className="mt-1 text-xs text-[#5c6b7a]">
          Upsert default config keys (loan days, reminders, backup settings, etc.) without wiping data.
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
