import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

const KEY_LABEL = {
  LOAN_DAYS: 'Loan period (days)',
  MIN_PASSWORD_LENGTH: 'Minimum password length',
  MAX_BORROW_BOOKS: 'Max concurrent loans per reader',
  FINE_RATE_PER_DAY: 'Fine per day (reserved)',
  READER_CARD_ID_PATTERN: 'Reader card ID pattern (regex, policy)',
}

export function AdminRulesPage() {
  const [configRows, setConfigRows] = useState([])
  const [configDraft, setConfigDraft] = useState({})
  const [configMsg, setConfigMsg] = useState('')
  const [configErr, setConfigErr] = useState('')

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/config')
      const items = res.items || []
      setConfigRows(items)
      const draft = {}
      for (const row of items) draft[row.key] = row.value
      setConfigDraft(draft)
    } catch (e) {
      setConfigErr(e.message || 'Failed to load configuration')
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  async function saveConfig(e) {
    e.preventDefault()
    setConfigMsg('')
    setConfigErr('')
    try {
      const entries = Object.entries(configDraft).map(([key, value]) => ({ key, value }))
      await apiFetch('/api/admin/config', {
        method: 'PATCH',
        body: JSON.stringify({ entries }),
      })
      setConfigMsg('Saved.')
      await loadConfig()
    } catch (e) {
      setConfigErr(e.message || 'Save failed')
    }
  }

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Loan rules</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Loan length, password policy, and borrowing limits apply to new activity after save.</p>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        {configErr ? <p className="mb-3 text-sm text-[#b42318]">{configErr}</p> : null}
        <form onSubmit={saveConfig} className="space-y-4">
          {configRows.map((row) => (
            <div key={row.key}>
              <label className="mb-1 block text-sm font-medium text-[#1a2b3c]" htmlFor={`cfg-${row.key}`}>
                {KEY_LABEL[row.key] || row.key}
              </label>
              {row.description ? <p className="mb-1 text-xs text-[#5c6b7a]">{row.description}</p> : null}
              <input
                id={`cfg-${row.key}`}
                value={configDraft[row.key] ?? ''}
                onChange={(e) => setConfigDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                className={inputClass}
              />
            </div>
          ))}
          {configMsg ? <p className="text-sm text-[#0d7a4f]">{configMsg}</p> : null}
          <Button type="submit">Save</Button>
        </form>
      </div>
    </div>
  )
}
