/** Default home path after login for each role. */
export function homePathForRole(role) {
  if (role === 'ADMIN') return '/admin/dashboard'
  if (role === 'LIBRARIAN') return '/librarian/dashboard'
  return '/books'
}
