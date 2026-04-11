import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

function roleLabel(role) {
  if (role === 'MEMBER') return 'Student'
  if (role === 'LIBRARIAN') return 'Librarian'
  if (role === 'ADMIN') return 'Admin'
  return role
}

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="library-app flex min-h-svh flex-col text-left">
      <header className="library-panel mb-10 flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
        <div className="flex items-start gap-4">
          <span
            className="library-brand-icon mt-0.5 shrink-0 text-base"
            aria-hidden
          >
            L
          </span>
          <div className="space-y-2">
            <Link
              to="/books"
              className="text-foreground text-xl font-semibold tracking-tight transition-colors hover:text-primary"
            >
              Library · Catalog
            </Link>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              Browse the collection, search by title or author, and open any book for details.
            </p>
          </div>
        </div>
        {user && (
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-muted-foreground text-sm leading-relaxed">
              {user.fullName}
              <span className="ml-3 rounded-md border border-primary/15 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
                {roleLabel(user.role)}
              </span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        )}
      </header>
      <main className="flex-1 pb-8">
        <Outlet />
      </main>
    </div>
  )
}
