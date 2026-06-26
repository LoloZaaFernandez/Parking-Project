import { createContext, useContext, useEffect, useState } from 'react'

const BASE = 'http://localhost:8000'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('parking_token'))
  const [loading, setLoading] = useState(true)

  // On mount: restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('parking_token')
    if (!storedToken) {
      setLoading(false)
      return
    }

    fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token inválido')
        return res.json()
      })
      .then((userData) => {
        setUser(userData)
        setToken(storedToken)
      })
      .catch(() => {
        localStorage.removeItem('parking_token')
        localStorage.removeItem('parking_user')
        setUser(null)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const body = new URLSearchParams()
    body.append('username', username)
    body.append('password', password)

    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error de autenticación' }))
      throw err
    }

    const data = await res.json()
    const { access_token, user: userData } = data

    localStorage.setItem('parking_token', access_token)
    localStorage.setItem('parking_user', JSON.stringify(userData))
    setToken(access_token)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('parking_token')
    localStorage.removeItem('parking_user')
    setToken(null)
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, token, loading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
