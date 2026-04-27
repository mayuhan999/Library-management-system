import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from '@/lib/nav'

export function RoleProtected({ allow, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="library-app flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-3">
          <span
            className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading…
        </span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  return children
}
