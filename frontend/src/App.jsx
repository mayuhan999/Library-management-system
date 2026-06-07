import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleProtected } from '@/components/RoleProtected'
import { LibrarianLayout } from '@/components/LibrarianLayout'
import { AdminLayout } from '@/components/AdminLayout'
import { UnifiedLoginPage } from '@/pages/UnifiedLoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { CatalogPage } from '@/pages/CatalogPage'
import { BookDetailPage } from '@/pages/BookDetailPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminPermissionsPage } from '@/pages/admin/AdminPermissionsPage'
import { AdminSystemPage } from '@/pages/admin/AdminSystemPage'
import { AdminRulesPage } from '@/pages/admin/AdminRulesPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminPaymentsPage } from '@/pages/admin/AdminPaymentsPage'
import { LibrarianDashboardPage } from '@/pages/librarian/LibrarianDashboardPage'
import { LibrarianDeskPage } from '@/pages/librarian/LibrarianDeskPage'
import { LibrarianAccountPage } from '@/pages/librarian/LibrarianAccountPage'
import { LibrarianNewBookPage } from '@/pages/librarian/LibrarianNewBookPage'
import { LibrarianBookLabelsPage } from '@/pages/librarian/LibrarianBookLabelsPage'
import { LibrarianInventoryPage } from '@/pages/librarian/LibrarianInventoryPage'
import { LibrarianHoldsQueuePage } from '@/pages/librarian/LibrarianHoldsQueuePage'
import { LibrarianReportsPage } from '@/pages/librarian/LibrarianReportsPage'
import { ReaderLoansPage } from '@/pages/reader/ReaderLoansPage'
import { ReaderHistoryPage } from '@/pages/reader/ReaderHistoryPage'
import { ReaderHoldsPage } from '@/pages/reader/ReaderHoldsPage'
import { ReaderAccountPage } from '@/pages/reader/ReaderAccountPage'
import { ReaderAlipayPayPage } from '@/pages/reader/ReaderAlipayPayPage'
import { homePathForRole } from '@/lib/nav'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="b-app flex min-h-[50vh] items-center justify-center text-sm text-[#5c6b7a]">
        <span className="inline-flex items-center gap-3">
          <span
            className="size-4 animate-spin rounded-full border-2 border-[#003366] border-t-transparent"
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
  return <Navigate to={homePathForRole(user.role)} replace />
}

function LibrarianShell() {
  return (
    <RoleProtected allow={['LIBRARIAN', 'ADMIN']}>
      <LibrarianLayout />
    </RoleProtected>
  )
}

function AdminShell() {
  return (
    <RoleProtected allow={['ADMIN']}>
      <AdminLayout />
    </RoleProtected>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<UnifiedLoginPage />} />
      <Route path="/login/reader" element={<Navigate to="/login" replace />} />
      <Route path="/login/librarian" element={<Navigate to="/login" replace />} />
      <Route path="/login/admin" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="books">
            <Route index element={<CatalogPage />} />
            <Route path=":id" element={<BookDetailPage />} />
          </Route>
          <Route
            path="reader/loans"
            element={
              <RoleProtected allow={['MEMBER']}>
                <ReaderLoansPage />
              </RoleProtected>
            }
          />
          <Route
            path="reader/history"
            element={
              <RoleProtected allow={['MEMBER']}>
                <ReaderHistoryPage />
              </RoleProtected>
            }
          />
          <Route
            path="reader/holds"
            element={
              <RoleProtected allow={['MEMBER']}>
                <ReaderHoldsPage />
              </RoleProtected>
            }
          />
          <Route
            path="reader/account"
            element={
              <RoleProtected allow={['MEMBER']}>
                <ReaderAccountPage />
              </RoleProtected>
            }
          />
          <Route
            path="reader/pay/:paymentId"
            element={
              <RoleProtected allow={['MEMBER']}>
                <ReaderAlipayPayPage />
              </RoleProtected>
            }
          />
        </Route>

        <Route path="librarian" element={<LibrarianShell />}>
          <Route index element={<Navigate to="/librarian/dashboard" replace />} />
          <Route path="dashboard" element={<LibrarianDashboardPage />} />
          <Route path="desk" element={<LibrarianDeskPage />} />
          <Route path="account" element={<LibrarianAccountPage />} />
          <Route path="books/new" element={<LibrarianNewBookPage />} />
          <Route path="books/:bookId/labels" element={<LibrarianBookLabelsPage />} />
          <Route path="inventory" element={<LibrarianInventoryPage />} />
          <Route path="holds" element={<LibrarianHoldsQueuePage />} />
          <Route path="reports" element={<LibrarianReportsPage />} />
        </Route>

        <Route path="admin" element={<AdminShell />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="permissions" element={<AdminPermissionsPage />} />
          <Route path="system" element={<AdminSystemPage />} />
          <Route path="rules" element={<AdminRulesPage />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
