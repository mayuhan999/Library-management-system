import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export function RegisterPage() {
  const { register, user } = useAuth()
  const location = useLocation()
  const from = location.state?.from || '/books'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (user) {
    return <Navigate to="/books" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setPending(true)
    try {
      await register(email, password, fullName, from)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setPending(false)
    }
  }

  const inputClass =
    'w-full rounded-sm border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm text-[#1a2b3c] outline-none transition focus:border-[#003366] focus:ring-1 focus:ring-[#6b8cae]'

  return (
    <div className="b-app min-h-svh bg-[#f5f5f5] px-4 py-12">
      <div className="mx-auto w-full max-w-[420px] rounded-sm border border-[#e5e8eb] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#003366]">Reader registration</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">New accounts are readers (MEMBER): search, borrow, and place holds.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="reg-name">
              Full name
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3d4f5f]" htmlFor="reg-password">
              Password (at least 6 characters)
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
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
          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? 'Submitting…' : 'Register and sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[#5c6b7a]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[#003366] underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
