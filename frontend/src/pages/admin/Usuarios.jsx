import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

function RoleBadge({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        isAdmin
          ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-600/40'
          : 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-600/40'
      }`}
    >
      {isAdmin ? 'Administrador' : 'Cajero'}
    </span>
  )
}

export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState('')

  // Add form state
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('cashier')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  function load() {
    setLoading(true)
    apiFetch('/auth/users')
      .then(setUsers)
      .catch(() => setError('No se pudieron cargar los usuarios'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword.trim()) {
      setAddError('Completá todos los campos')
      return
    }
    if (newPassword.length < 6) {
      setAddError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setAddLoading(true)
    setAddError('')
    try {
      await apiFetch('/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      })
      setNewUsername('')
      setNewPassword('')
      setNewRole('cashier')
      setShowAddForm(false)
      load()
    } catch (err) {
      setAddError(err?.detail || 'No se pudo crear el usuario')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDelete(u) {
    if (
      !confirm(
        `¿Eliminás al usuario '${u.username}'? Esta acción es irreversible y no se puede deshacer.`
      )
    )
      return
    try {
      await apiFetch(`/auth/users/${u.id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      alert(err?.detail || 'No se pudo eliminar el usuario')
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usuarios</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {users.length} usuario{users.length !== 1 ? 's' : ''} · {adminCount} administrador
            {adminCount !== 1 ? 'es' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowAddForm((v) => !v); setAddError('') }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                       rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {showAddForm ? 'Cancelar' : '+ Agregar usuario'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-[#1a1d27] border border-blue-500/30 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Nuevo usuario</h3>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                Usuario
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="nombre.usuario"
                required
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2
                           text-sm text-white placeholder-gray-600
                           focus:outline-none focus:border-blue-500 w-40"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2
                           text-sm text-white placeholder-gray-600
                           focus:outline-none focus:border-blue-500 w-48"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
                Rol
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2
                           text-sm text-white focus:outline-none focus:border-blue-500 w-40"
              >
                <option value="cashier">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              {addError && <span className="text-red-400 text-xs">{addError}</span>}
              <button
                type="submit"
                disabled={addLoading}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50
                           text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {addLoading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1117] text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-center">Rol</th>
                <th className="px-4 py-3 text-left">Creado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-600">
                    Cargando…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-600">
                    No hay usuarios que mostrar
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-gray-800/60 hover:bg-[#0f1117]/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-200 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-center">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString('es-PE') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDelete(u)}
                          className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400
                                     text-xs rounded transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
