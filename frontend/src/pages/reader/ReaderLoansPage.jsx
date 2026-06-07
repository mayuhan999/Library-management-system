import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

export function ReaderLoansPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [renewingId, setRenewingId] = useState(null)
  const [maxRenewalsPerLoan, setMaxRenewalsPerLoan] = useState(1)

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await apiFetch('/api/reader/loans')
      setItems(res.items || [])
      if (typeof res.meta?.maxRenewalsPerLoan === 'number') {
        setMaxRenewalsPerLoan(res.meta.maxRenewalsPerLoan)
      }
    } catch (e) {
      setErr(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleRenew(loanId) {
    setErr('')
    setSuccessMsg('')
    setRenewingId(loanId)
    try {
      const res = await apiFetch(`/api/reader/loans/${loanId}/renew`, { method: 'POST' })
      const newDue = res.loan?.dueAt
      await load()
      setSuccessMsg(
        newDue
          ? `Renewed. New due date: ${new Date(newDue).toLocaleString()}`
          : 'Renewed.',
      )
    } catch (e) {
      setErr(e.message || 'Renew failed')
    } finally {
      setRenewingId(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="b-app max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">My loans</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Active and past loans. Overdue rows are highlighted.</p>
      </div>

      {err ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {err}
        </p>
      ) : null}
      {successMsg ? (
        <p className="text-sm font-medium text-[#0d7a4f]" role="status">
          {successMsg}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#5c6b7a]">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Book</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Library barcode</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Borrowed</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Due</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Renews</th>
                <th className="px-3 py-2 font-medium text-[#3d4f5f]">Status</th>
                <th className="px-3 py-2 text-right font-medium text-[#3d4f5f]">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((loan) => {
                const overdue = loan.displayStatus === 'OVERDUE'
                const isActive = loan.status === 'BORROWED' && !overdue
                const renewCount = loan.renewCount ?? 0
                const canRenew = isActive && renewCount < maxRenewalsPerLoan
                return (
                  <tr
                    key={loan.id}
                    className={['border-b border-[#f0f2f4]', overdue ? 'bg-[#fef3f2]' : 'hover:bg-[#fafafa]'].join(' ')}
                  >
                    <td className="px-3 py-2.5">
                      <Link to={`/books/${loan.bookId}`} className="font-medium text-[#003366] hover:underline">
                        {loan.book?.title}
                      </Link>
                      <div className="text-xs text-[#5c6b7a]">{loan.book?.author}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#5c6b7a]">
                      {loan.bookCopy?.libraryBarcode ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#5c6b7a]">{new Date(loan.borrowedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5">{new Date(loan.dueAt).toLocaleDateString()}</td>
                    <td
                      className="px-3 py-2.5 tabular-nums text-[#5c6b7a]"
                      title={`Renewals used / max (${maxRenewalsPerLoan}) from library rules`}
                    >
                      {loan.status === 'BORROWED' ? `${renewCount} / ${maxRenewalsPerLoan}` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {overdue ? (
                        <span className="rounded-sm border border-[#f04438] bg-[#fef3f2] px-2 py-0.5 text-xs font-semibold text-[#b42318]">
                          Overdue
                        </span>
                      ) : loan.status === 'RETURNED' ? (
                        <span className="rounded-sm border border-[#d0d5dd] bg-[#f5f5f5] px-2 py-0.5 text-xs text-[#5c6b7a]">
                          Returned
                        </span>
                      ) : (
                        <span className="rounded-sm border border-[#0d7a4f]/40 bg-[#ecfdf3] px-2 py-0.5 text-xs font-semibold text-[#0d7a4f]">
                          On loan
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        {isActive && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRenew(loan.id)}
                            disabled={renewingId === loan.id || !canRenew}
                            title={
                              !canRenew
                                ? maxRenewalsPerLoan <= 0
                                  ? 'Renewals are not enabled'
                                  : 'Maximum renewals reached'
                                : undefined
                            }
                          >
                            {renewingId === loan.id ? 'Renewing…' : 'Renew'}
                          </Button>
                        )}
                        <Link to={`/books/${loan.bookId}`}>
                          <Button type="button" size="sm" variant="outline">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
