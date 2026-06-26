const BASE = import.meta.env.DEV ? 'http://localhost:8000' : ''

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('parking_token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('parking_token')
    localStorage.removeItem('parking_user')
    window.location.reload()
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error desconocido' }))
    throw err
  }

  return res.json()
}
