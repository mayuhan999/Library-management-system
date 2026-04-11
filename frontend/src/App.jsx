import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { CatalogPage } from '@/pages/CatalogPage'
import { BookDetailPage } from '@/pages/BookDetailPage'

function GuestLogin() {
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
  if (user) {
    return <Navigate to="/books" replace />
  }
  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestLogin />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/books" element={<AppLayout />}>
          <Route index element={<CatalogPage />} />
          <Route path=":id" element={<BookDetailPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/books" replace />} />
      <Route path="*" element={<Navigate to="/books" replace />} />
    </Routes>
  )
}
