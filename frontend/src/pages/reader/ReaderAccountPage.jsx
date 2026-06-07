import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'

function statusBadge(status) {
  const map = {
    BORROWED: 'bg-[#e8eef4] text-[#003366]',
    DUE_SOON: 'bg-[#fff4e5] text-[#b54708]',
    OVERDUE: 'bg-[#fef3f2] text-[#b42318]',
    ACTIVE: 'bg-[#e8eef4] text-[#003366]',
    APPROVED: 'bg-[#eff8ff] text-[#175cd3]',
    READY: 'bg-[#ecfdf3] text-[#027a48]',
  }
  return map[status] || 'bg-[#f5f5f5] text-[#5c6b7a]'
}

export function ReaderAccountPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState(null)
  const [pwdErr, setPwdErr] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [sum, msgs] = await Promise.all([
        apiFetch('/api/reader/account-summary'),
        apiFetch('/api/reader/messages'),
      ])
      setSummary(sum)
      setMessages(msgs.items || [])
      setUnreadCount(msgs.unreadCount || 0)
    } catch (e) {
      setErr(e.message || 'Failed to load account')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markRead(id) {
    await apiFetch(`/api/reader/messages/${id}/read`, { method: 'PATCH' })
    await load()
  }

  async function markAllRead() {
    await apiFetch('/api/reader/messages/read-all', { method: 'POST', body: JSON.stringify({}) })
    await load()
  }

  async function payFineAlipay(loanId) {
    try {
      const res = await apiFetch(`/api/payments/fines/${loanId}/alipay`, { method: 'POST', body: JSON.stringify({}) })
      window.location.href = res.payUrl
    } catch (e) {
      setErr(e.message || 'Could not start Alipay payment')
    }
  }

  async function handlePassword(e) {
    e.preventDefault()
    setPwdMsg(null)
    setPwdErr(null)
    if (!currentPassword || !newPassword) {
      setPwdErr('Please fill in all fields')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdErr('New passwords do not match')
      return
    }
    setPwdLoading(true)
    try {
      const data = await apiFetch('/api/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setPwdMsg(data.message || 'Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
    } catch (e) {
      setPwdErr(e.message || 'Failed to update password')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="b-app max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Account status center</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          R1.08 — Borrowed books, due list, reservations, fines, and in-app messages (R1.06).
        </p>
      </div>

      {err ? <p className="text-sm text-[#b42318]">{err}</p> : null}
      {loading ? <p className="text-sm text-[#5c6b7a]">Loading…</p> : null}

      {!loading && summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
              <p className="text-xs text-[#5c6b7a]">On loan</p>
              <p className="mt-1 text-2xl font-semibold text-[#003366]">{summary.borrowed?.length ?? 0}</p>
            </div>
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
              <p className="text-xs text-[#5c6b7a]">Due soon</p>
              <p className="mt-1 text-2xl font-semibold text-[#b54708]">{summary.dueSoonList?.length ?? 0}</p>
              <p className="text-[10px] text-[#5c6b7a]">Within {summary.meta?.reminderDaysAhead ?? 3} days</p>
            </div>
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
              <p className="text-xs text-[#5c6b7a]">Reservations</p>
              <p className="mt-1 text-2xl font-semibold text-[#003366]">{summary.holds?.length ?? 0}</p>
            </div>
            <div className="rounded-sm border border-[#e5e8eb] bg-white p-4">
              <p className="text-xs text-[#5c6b7a]">Unpaid fines</p>
              <p className="mt-1 text-2xl font-semibold text-[#b42318]">
                ${summary.unpaidFines?.totalAmount?.toFixed(2) ?? '0.00'}
              </p>
            </div>
          </div>

          <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1a2b3c]">
                Messages {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
              </h2>
              {unreadCount > 0 ? (
                <Button type="button" size="sm" variant="secondary" onClick={markAllRead}>
                  Mark all read
                </Button>
              ) : null}
            </div>
            {messages.length === 0 ? (
              <p className="text-sm text-[#5c6b7a]">No messages yet.</p>
            ) : (
              <ul className="divide-y divide-[#f0f2f4]">
                {messages.slice(0, 10).map((m) => (
                  <li key={m.id} className={`py-3 ${!m.readAt ? 'bg-[#fafcff]' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#1a2b3c]">{m.title}</p>
                        <p className="mt-0.5 text-sm text-[#5c6b7a]">{m.body}</p>
                        <p className="mt-1 text-xs text-[#8a96a3]">{new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                      {!m.readAt ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => markRead(m.id)}>
                          Read
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#1a2b3c]">Currently borrowed</h2>
            {summary.borrowed?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e8eb] text-xs text-[#5c6b7a]">
                      <th className="py-2 pr-3">Book</th>
                      <th className="py-2 pr-3">Due</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.borrowed.map((l) => (
                      <tr key={l.id} className="border-b border-[#f0f2f4]">
                        <td className="py-2 pr-3">
                          <Link to={`/books/${l.book.id}`} className="text-[#003366] hover:underline">
                            {l.book.title}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{new Date(l.dueAt).toLocaleDateString()}</td>
                        <td className="py-2">
                          <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${statusBadge(l.displayStatus)}`}>
                            {l.displayStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#5c6b7a]">No active loans.</p>
            )}
            <Link to="/reader/loans" className="mt-3 inline-block text-xs font-medium text-[#003366] hover:underline">
              View all loans →
            </Link>
          </section>

          <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#1a2b3c]">Reservations</h2>
            {summary.holds?.length ? (
              <ul className="space-y-2 text-sm">
                {summary.holds.map((h) => (
                  <li key={h.id} className="flex items-center justify-between border-b border-[#f0f2f4] py-2">
                    <span>{h.book.title}</span>
                    <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${statusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#5c6b7a]">No active reservations.</p>
            )}
            <Link to="/reader/holds" className="mt-3 inline-block text-xs font-medium text-[#003366] hover:underline">
              Manage holds →
            </Link>
          </section>

          <section className="rounded-sm border border-[#e5e8eb] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#1a2b3c]">Unpaid fines</h2>
            {summary.unpaidFines?.items?.length ? (
              <ul className="space-y-2 text-sm">
                {summary.unpaidFines.items.map((l) => (
                  <li key={l.id} className="flex items-center justify-between border-b border-[#f0f2f4] py-2">
                    <span>
                      {l.book.title} — <strong>${l.fineAmount.toFixed(2)}</strong>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#1677ff] hover:bg-[#0958d9]"
                      onClick={() => payFineAlipay(l.id)}
                      title="Pay fine via Alipay sandbox QR"
                    >
                      Pay with Alipay
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#5c6b7a]">No outstanding fines.</p>
            )}
          </section>
        </>
      ) : null}

      <dl className="rounded-sm border border-[#e5e8eb] bg-white p-5 text-sm">
        <div className="flex justify-between border-b border-[#f0f2f4] py-2">
          <dt className="text-[#5c6b7a]">Name</dt>
          <dd className="font-medium text-[#1a2b3c]">{user?.fullName}</dd>
        </div>
        <div className="flex justify-between border-b border-[#f0f2f4] py-2">
          <dt className="text-[#5c6b7a]">Email</dt>
          <dd className="font-mono text-xs text-[#1a2b3c]">{user?.email}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[#5c6b7a]">Role</dt>
          <dd>
            <span className="rounded-sm border border-[#003366]/25 bg-[#e8eef4] px-2 py-0.5 text-xs font-medium text-[#003366]">
              Reader
            </span>
          </dd>
        </div>
      </dl>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        {!showPassword ? (
          <Button type="button" onClick={() => setShowPassword(true)}>
            Change password
          </Button>
        ) : (
          <form onSubmit={handlePassword} className="space-y-4">
            <h2 className="text-base font-semibold text-[#003366]">Change password</h2>
            {pwdErr ? <p className="text-sm text-[#b42318]">{pwdErr}</p> : null}
            {pwdMsg ? <p className="text-sm text-[#0d7a4f]">{pwdMsg}</p> : null}
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="block w-full rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={pwdLoading}>
                {pwdLoading ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowPassword(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
