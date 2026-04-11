import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()
  const from = location.state?.from || '/books'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await login(email, password, from)
    } catch (err) {
      setError(err.message || 'Sign-in failed')
    } finally {
      setPending(false)
    }
  }

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
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">Sign in</h1>
          </div>
        </div>
        <div className="library-auth-intro text-muted-foreground text-sm leading-relaxed">
          <p>Use your account to access the catalog.</p>
          <p>
            Demo account (run{' '}
            <code className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-xs text-foreground">
              npm run seed
            </code>{' '}
            in the backend first):
          </p>
          <p className="text-foreground/90 font-medium">
            student1@library.local / student123
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-input bg-background ring-offset-background focus:border-primary/50 focus-visible:ring-ring w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-input bg-background ring-offset-background focus:border-primary/50 focus-visible:ring-ring w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2"
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm leading-relaxed" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full font-bold" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-muted-foreground mt-10 text-center text-sm leading-relaxed">
          No account yet?{' '}
          <Link
            to="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
