const API_PREFIX = import.meta.env.VITE_API_BASE || ''

export function getToken() {
  return localStorage.getItem('library_token')
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('library_token', token)
  } else {
    localStorage.removeItem('library_token')
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const url = `${API_PREFIX}${path}`
  const res = await fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
