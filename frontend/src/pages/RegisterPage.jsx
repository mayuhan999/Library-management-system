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
    'border-input bg-background ring-offset-background focus:border-primary/50 focus-visible:ring-ring w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2'

  return (
    <div className="library-auth-screen library-app">
      <div className="library-auth-card">
        <div className="library-brand">
          <span className="library-brand-icon shrink-0 text-base" aria-hidden>
            L
          </span>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide">
              Library Management System
            </p>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Student registration
            </h1>
          </div>
        </div>
        <div className="library-auth-intro text-muted-foreground text-sm leading-relaxed">
          <p>Your role will be Student (MEMBER).</p>
          <p>You can browse and search the catalog after signing up.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="reg-name">
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
            <label className="mb-1.5 block text-sm font-medium" htmlFor="reg-email">
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
            <label className="mb-1.5 block text-sm font-medium" htmlFor="reg-password">
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
            <p className="text-destructive text-sm leading-relaxed" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full font-bold" disabled={pending}>
            {pending ? 'Submitting…' : 'Register and sign in'}
          </Button>
        </form>
        <p className="text-muted-foreground mt-10 text-center text-sm leading-relaxed">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
