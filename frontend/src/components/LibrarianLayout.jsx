import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

const nav = [
  { to: '/librarian/desk', label: 'Desk checkout' },
  { to: '/librarian/books/new', label: 'Add book' },
  { to: '/librarian/inventory', label: 'Inventory' },
  { to: '/librarian/holds', label: 'Hold queue' },
]

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function linkClass({ isActive }) {
  return [
    'rounded-sm border px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'border-[#003366] bg-[#003366] text-white shadow-sm' : 'border-transparent text-[#1a2b3c] hover:border-[#d0d5dd] hover:bg-[#f5f5f5]',
  ].join(' ')
}

export function LibrarianLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="b-app flex min-h-svh bg-[#f5f5f5]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#e5e8eb] bg-white lg:w-[240px]">
        <div className="border-b border-[#e5e8eb] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5c6b7a]">Librarian</p>
          <p className="mt-1 text-sm font-semibold text-[#003366]">Circulation</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#e5e8eb] p-3">
          <NavLink
            to="/books"
            className="mb-2 block rounded-sm border border-[#e5e8eb] px-3 py-2 text-center text-sm font-medium text-[#003366] hover:bg-[#f5f5f5]"
          >
            Open catalog
          </NavLink>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#e5e8eb] bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#003366]/30 bg-[#e8eef4] text-xs font-bold text-[#003366]">
              {user ? initials(user.fullName) : '—'}
            </span>
            <div>
              <p className="text-sm font-medium text-[#1a2b3c]">{user?.fullName}</p>
              <p className="text-xs text-[#5c6b7a]">Librarian</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
