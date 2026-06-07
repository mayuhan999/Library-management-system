import { useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

const now = new Date()

export function LibrarianReportsPage() {
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function loadReport() {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch(`/api/librarian/reports/monthly?year=${year}&month=${month}`)
      setReport(res)
    } catch (e) {
      setErr(e.message || 'Failed to load report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  function downloadCsv() {
    const base = import.meta.env.VITE_API_BASE || ''
    const token = localStorage.getItem('library_token')
    const url = `${base}/api/librarian/reports/monthly?year=${year}&month=${month}&format=csv`
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (!r.ok) throw new Error('Export failed')
        return r.blob()
      })
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `library-report-${year}-${month.padStart(2, '0')}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch((e) => setErr(e.message))
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Monthly reports</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          L1.06 — Lost, damaged, and overdue statistics with CSV export.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-sm border border-[#e5e8eb] bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-[#5c6b7a]">Year</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5c6b7a]">Month</label>
          <input value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} type="number" min="1" max="12" />
        </div>
        <Button type="button" onClick={loadReport} disabled={loading}>
          {loading ? 'Loading…' : 'Generate'}
        </Button>
        <Button type="button" variant="secondary" onClick={downloadCsv}>
          Export CSV
        </Button>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}

      {report ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4 text-sm">
              <p className="text-[#5c6b7a]">Incidents</p>
              <p className="text-xl font-semibold">{report.summary.incidents}</p>
            </div>
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4 text-sm">
              <p className="text-[#5c6b7a]">Overdue returns</p>
              <p className="text-xl font-semibold">{report.summary.overdueReturns}</p>
            </div>
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4 text-sm">
              <p className="text-[#5c6b7a]">Lost loans</p>
              <p className="text-xl font-semibold">{report.summary.lostLoans}</p>
            </div>
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4 text-sm">
              <p className="text-[#5c6b7a]">Total fines</p>
              <p className="text-xl font-semibold">${report.summary.totalFines.toFixed(2)}</p>
            </div>
          </div>

          <pre className="max-h-96 overflow-auto rounded-sm border border-[#e5e8eb] bg-[#f5f5f5] p-4 font-mono text-xs">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
