import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { homePathForRole } from '@/lib/nav'
import { cn } from '@/lib/utils'

const ROLES = [
  { id: 'MEMBER', label: 'Reader' },
  { id: 'LIBRARIAN', label: 'Librarian' },
  { id: 'ADMIN', label: 'Admin' },
]

export function UnifiedLoginPage() {
  const { login, user, loading } = useAuth()
  const location = useLocation()
  const from = location.state?.from

  const [tab, setTab] = useState('MEMBER')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (loading) {
    return (
      <div className="b-app flex min-h-svh items-center justify-center text-sm text-[#5c6b7a]">
        <span className="inline-flex items-center gap-2">
          <span
            className="size-4 animate-spin rounded-full border-2 border-[#003366] border-t-transparent"
            aria-hidden
          />
          Loading…
        </span>
      </div>
    )
  }

  if (user) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      const fallback = tab === 'MEMBER' ? '/books' : tab === 'LIBRARIAN' ? '/librarian/desk' : '/admin/users'
      const redirectTo =
        typeof from === 'string' && from.length > 0 && from !== '/login' ? from : fallback
      await login(email, password, redirectTo, tab)
    } catch (err) {
      setError(err.message || 'Sign-in failed')
    } finally {
      setPending(false)
    }
  }

  const inputClass =
    'w-full rounded-sm border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm text-[#1a2b3c] outline-none transition placeholder:text-[#8a96a3] focus:border-[#003366] focus:ring-1 focus:ring-[#003366]'

  return (
    <div className="b-app min-h-svh bg-[#f5f5f5] px-4 py-12">
      <div className="mx-auto w-full max-w-[420px] rounded-sm border border-[#e5e8eb] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-[#003366]">Library Management System</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Choose your role and sign in.</p>

        <div className="mt-6 flex rounded-sm border border-[#e5e8eb] p-0.5">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setTab(r.id)
                setError('')
              }}
              className={cn(
                'flex-1 rounded-sm border border-transparent px-2 py-2 text-center text-xs font-medium transition sm:text-sm',
                tab === r.id
                  ? 'border-[#003366] bg-[#003366] text-white shadow-sm'
                  : 'bg-transparent text-[#5c6b7a] hover:border-[#d0d5dd] hover:bg-[#f5f5f5]',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="login-pw">
              Password
            </label>
            <input
              id="login-pw"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error ? (
            <p className="text-sm text-[#b42318]" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full text-sm font-medium" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[#5c6b7a]">
          Reader registration:{' '}
          <Link to="/register" className="font-medium text-[#003366] underline-offset-2 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
