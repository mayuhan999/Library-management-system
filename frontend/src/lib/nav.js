/** Default home path after login for each role. */
export function homePathForRole(role) {
  if (role === 'ADMIN') return '/admin/users'
  if (role === 'LIBRARIAN') return '/librarian/desk'
  return '/books'
}
