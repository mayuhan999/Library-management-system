import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

function roleLabel(role) {
  if (role === 'MEMBER') return 'Reader'
  if (role === 'LIBRARIAN') return 'Librarian'
  if (role === 'ADMIN') return 'Admin'
  return role
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function navClass(isActive) {
  return [
    'block rounded-sm border px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'border-[#003366] bg-[#003366] text-white shadow-sm'
      : 'border-transparent text-[#1a2b3c] hover:border-[#d0d5dd] hover:bg-[#f5f5f5]',
  ].join(' ')
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  const showCatalogShell =
    user && (pathname.startsWith('/books') || pathname.startsWith('/reader/'))

  let sidebarNav = []
  let sidebarSubtitle = 'Reader'
  if (user?.role === 'MEMBER') {
    sidebarNav = [
      { to: '/books', label: 'Catalog search', end: true },
      { to: '/reader/loans', label: 'My loans' },
      { to: '/reader/holds', label: 'My holds' },
      { to: '/reader/account', label: 'Account' },
    ]
  } else if (user?.role === 'LIBRARIAN') {
    sidebarSubtitle = 'Librarian · Catalog'
    sidebarNav = [
      { to: '/books', label: 'Catalog', end: true },
      { to: '/librarian/desk', label: 'Desk checkout' },
      { to: '/librarian/books/new', label: 'Add book' },
      { to: '/librarian/inventory', label: 'Inventory' },
      { to: '/librarian/holds', label: 'Hold queue' },
    ]
  } else if (user?.role === 'ADMIN') {
    sidebarSubtitle = 'Admin · Catalog'
    sidebarNav = [
      { to: '/books', label: 'Catalog', end: true },
      { to: '/admin/users', label: 'Admin console' },
    ]
  }

  return (
    <div className="b-app flex min-h-svh bg-[#f5f5f5] text-left">
      {showCatalogShell ? (
        <>
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#e5e8eb] bg-white lg:w-[240px]">
            <div className="border-b border-[#e5e8eb] px-4 py-4">
              <Link to="/books" className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#003366]/25 bg-[#e8eef4]"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="size-5 text-[#003366]" fill="none" aria-hidden>
                    <path d="M6 4h12v16H6V4z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9 8h6M9 12h4" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.6" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#003366]">Library</span>
                  <span className="mt-0.5 block text-xs text-[#5c6b7a]">{sidebarSubtitle}</span>
                </span>
              </Link>
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-2">
              {sidebarNav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navClass(isActive)}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-[#e5e8eb] p-3">
              <div className="mb-3 flex items-center gap-2 rounded-sm border border-[#e5e8eb] bg-[#fafafa] px-2 py-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#d0d5dd] bg-white text-xs font-semibold text-[#003366]"
                  aria-hidden
                >
                  {user ? initials(user.fullName) : '—'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#1a2b3c]">{user?.fullName}</p>
                  <p className="text-[10px] text-[#5c6b7a]">{roleLabel(user?.role)}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => logout()}>
                Sign out
              </Button>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-b border-[#e5e8eb] bg-white px-4 py-3 lg:px-8">
              <h1 className="text-base font-semibold text-[#003366]">Library Management System</h1>
              <p className="mt-0.5 text-xs text-[#5c6b7a]">Release 1 · Catalog & circulation</p>
            </header>
            <main className="flex-1 overflow-auto px-4 py-6 lg:px-8">
              <Outlet />
            </main>
          </div>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#e5e8eb] bg-[#003366] text-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-white/20 bg-white/10"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
                    <path d="M6 4h12v16H6V4z" className="stroke-white" strokeWidth="1.8" />
                    <path d="M9 8h6M9 12h4" className="stroke-white/90" strokeWidth="1.6" />
                  </svg>
                </span>
                <div className="min-w-0 space-y-1">
                  <Link to="/books" className="block text-lg font-semibold tracking-tight text-white hover:underline">
                    Library
                  </Link>
                  <p className="text-sm text-white/85">Sign in to use the full catalog and tools.</p>
                </div>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            <Outlet />
          </main>
        </div>
      )}
    </div>
  )
}
