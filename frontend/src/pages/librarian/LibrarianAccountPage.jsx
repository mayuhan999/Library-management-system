import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/api/http'

export function LibrarianAccountPage() {
  const { user } = useAuth()

  const [showForm, setShowForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (!currentPassword || !newPassword) {
      setError('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setMessage(data.message || 'Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowForm(false)
    } catch (err) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="b-app max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Account</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Summary of your librarian profile.</p>
      </div>

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
              Librarian
            </span>
          </dd>
        </div>
      </dl>

      <div className="rounded-sm border border-[#e5e8eb] bg-white p-5">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-sm bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#002244]"
          >
            Change Password
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-base font-semibold text-[#003366]">Change Password</h2>

            {error && (
              <div className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-sm border border-green-300 bg-green-50 p-3 text-sm text-green-700">
                {message}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="currentPassword" className="block text-sm text-[#5c6b7a]">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm text-[#5c6b7a]">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-[#5c6b7a]">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-[#e5e8eb] px-3 py-2 text-sm focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-sm bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#002244] disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                  setMessage(null)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="rounded-sm border border-[#e5e8eb] px-4 py-2 text-sm font-medium text-[#5c6b7a] hover:bg-[#f0f2f4]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
