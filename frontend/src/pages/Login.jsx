import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🅿</div>
          <h1 className="text-xl font-bold text-white tracking-tight">Sistema de Estacionamiento</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresá tus credenciales para continuar</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder="nombre de usuario"
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5
                           text-sm text-white placeholder-gray-600
                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                           transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5
                           text-sm text-white placeholder-gray-600
                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                           transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5
                              text-sm text-red-400 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50
                         text-white font-semibold rounded-lg px-4 py-2.5 text-sm
                         transition-colors disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          El acceso es solo para personal autorizado
        </p>
      </div>
    </div>
  )
}
