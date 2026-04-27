import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/api/http'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/lib/formStyles'

const roleText = (r) => {
  if (r === 'MEMBER') return 'Reader'
  if (r === 'LIBRARIAN') return 'Librarian'
  if (r === 'ADMIN') return 'Admin'
  return r
}

export function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [userQ, setUserQ] = useState('')
  const [userLoading, setUserLoading] = useState(true)
  const [userErr, setUserErr] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('MEMBER')
  const [createMsg, setCreateMsg] = useState('')
  const [createErr, setCreateErr] = useState('')

  const loadUsers = useCallback(async () => {
    setUserLoading(true)
    setUserErr('')
    try {
      const qs = new URLSearchParams({ page: String(userPage), limit: '15' })
      if (userQ.trim()) qs.set('q', userQ.trim())
      const res = await apiFetch(`/api/admin/users?${qs}`)
      setUsers(res.items || [])
      setUserTotal(res.total || 0)
    } catch (e) {
      setUserErr(e.message || 'Failed to load users')
    } finally {
      setUserLoading(false)
    }
  }, [userPage, userQ])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function runUserSearch() {
    setUserPage((p) => {
      if (p === 1) queueMicrotask(() => loadUsers())
      return 1
    })
  }

  async function toggleUser(u) {
    try {
      await apiFetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      })
      await loadUsers()
    } catch (e) {
      setUserErr(e.message || 'Update failed')
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    setCreateMsg('')
    setCreateErr('')
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          fullName: newName,
          role: newRole,
        }),
      })
      setCreateMsg('Account created.')
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setNewRole('MEMBER')
      await loadUsers()
    } catch (e) {
      setCreateErr(e.message || 'Could not create account')
    }
  }

  const totalPages = Math.max(1, Math.ceil(userTotal / 15))

  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">User management</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Create accounts, search, enable or disable users (disabled shown in red).</p>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#1a2b3c]">Create account</h2>
        <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="adm-email">
              Email
            </label>
            <input id="adm-email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="adm-pw">
              Password
            </label>
            <input id="adm-pw" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="adm-name">
              Full name
            </label>
            <input id="adm-name" required value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="adm-role">
              Role
            </label>
            <select id="adm-role" value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputClass}>
              <option value="MEMBER">Reader</option>
              <option value="LIBRARIAN">Librarian</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          {createErr ? <p className="text-sm text-[#b42318] sm:col-span-2">{createErr}</p> : null}
          {createMsg ? <p className="text-sm text-[#0d7a4f] sm:col-span-2">{createMsg}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit">Create account</Button>
          </div>
        </form>
      </div>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="user-search">
              Filter (email or name)
            </label>
            <input
              id="user-search"
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              placeholder="Search…"
              className={inputClass}
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => runUserSearch()}>
            Apply
          </Button>
        </div>

        {userErr ? <p className="mt-3 text-sm text-[#b42318]">{userErr}</p> : null}

        {userLoading ? (
          <p className="mt-4 text-sm text-[#5c6b7a]">Loading…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="b-table w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Email</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Name</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Role</th>
                  <th className="px-3 py-2 font-medium text-[#3d4f5f]">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-[#3d4f5f]">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#f0f2f4] hover:bg-[#fafafa]">
                    <td className="px-3 py-2.5 font-mono text-xs text-[#1a2b3c]">{u.email}</td>
                    <td className="px-3 py-2.5">{u.fullName}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-sm border border-[#003366]/25 bg-[#e8eef4] px-2 py-0.5 text-xs font-medium text-[#003366]">
                        {roleText(u.role)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {u.isActive ? (
                        <span className="font-medium text-[#0d7a4f]">Active</span>
                      ) : (
                        <span className="font-medium text-[#b42318]">Disabled</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => toggleUser(u)}>
                        {u.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={userPage <= 1} onClick={() => setUserPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-[#5c6b7a]">
              {userPage} / {totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={userPage >= totalPages} onClick={() => setUserPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
