import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

function StatusBadge({ active }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        active
          ? 'bg-green-500/15 text-green-400 ring-1 ring-green-600/40'
          : 'bg-gray-500/15 text-gray-500 ring-1 ring-gray-600/40'
      }`}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function PlateTag({ plate }) {
  return (
    <span className="bg-yellow-300 text-black font-mono font-black text-xs px-2 py-0.5 rounded border border-black tracking-wider">
      {plate}
    </span>
  )
}

export default function Abonados() {
  const [abonados, setAbonados] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeOnly, setActiveOnly] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  // Add form state
  const [newPlate, setNewPlate] = useState('')
  const [newName, setNewName] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit form state
  const [editPlate, setEditPlate] = useState('')
  const [editName, setEditName] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  function load() {
    setLoading(true)
    const qs = activeOnly ? '?active_only=true' : ''
    apiFetch(`/abonados/${qs}`)
      .then(setAbonados)
      .catch(() => setError('No se pudieron cargar los abonados'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [activeOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e) {
    e.preventDefault()
    if (!newPlate.trim() || !newName.trim()) {
      setAddError('Completá todos los campos')
      return
    }
    setAddLoading(true)
    setAddError('')
    try {
      await apiFetch('/abonados/', {
        method: 'POST',
        body: JSON.stringify({ plate: newPlate.toUpperCase().trim(), name: newName.trim() }),
      })
      setNewPlate('')
      setNewName('')
      setShowAddForm(false)
      load()
    } catch (err) {
      setAddError(err?.detail || 'No se pudo agregar el abonado')
    } finally {
      setAddLoading(false)
    }
  }

  function startEdit(ab) {
    setEditingId(ab.id)
    setEditPlate(ab.plate)
    setEditName(ab.name)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleEdit(id) {
    setEditLoading(true)
    try {
      await apiFetch(`/abonados/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ plate: editPlate.toUpperCase().trim(), name: editName.trim() }),
      })
      setEditingId(null)
      load()
    } catch (err) {
      alert(err?.detail || 'No se pudo actualizar el abonado')
    } finally {
      setEditLoading(false)
    }
  }

  async function toggleActive(ab) {
    try {
      await apiFetch(`/abonados/${ab.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !ab.active }),
      })
      load()
    } catch (err) {
      alert(err?.detail || 'No se pudo cambiar el estado')
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminás este abonado? Esta acción no se puede deshacer.')) return
    try {
      await apiFetch(`/abonados/${id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      alert(err?.detail || 'No se pudo eliminar el abonado')
    }
  }

  const activeCount = abonados.filter((a) => a.active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Abonados</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeCount} abonado{activeCount !== 1 ? 's' : ''} activo{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Active only toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setActiveOnly((v) => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                activeOnly ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  activeOnly ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="text-sm text-gray-400">Solo activos</span>
          </label>

          <button
            onClick={() => { setShowAddForm((v) => !v); setAddError('') }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                       rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {showAddForm ? 'Cancelar' : '+ Agregar abonado'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-[#1a1d27] border border-blue-500/30 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Nuevo abonado</h3>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Placa</label>
              <input
                type="text"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                placeholder="ABC-123"
                maxLength={8}
                required
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2
                           text-sm text-white placeholder-gray-600 uppercase
                           focus:outline-none focus:border-blue-500 w-32"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del titular"
                required
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2
                           text-sm text-white placeholder-gray-600
                           focus:outline-none focus:border-blue-500 w-56"
              />
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
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Registrado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-600">
                    Cargando…
                  </td>
                </tr>
              ) : abonados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-600">
                    No hay abonados que mostrar
                  </td>
                </tr>
              ) : (
                abonados.map((ab) => (
                  <tr
                    key={ab.id}
                    className="border-t border-gray-800/60 hover:bg-[#0f1117]/40 transition-colors"
                  >
                    {editingId === ab.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editPlate}
                            onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                            maxLength={8}
                            className="bg-[#0f1117] border border-gray-600 rounded px-2 py-1
                                       text-xs text-white uppercase focus:outline-none focus:border-blue-500 w-24"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-[#0f1117] border border-gray-600 rounded px-2 py-1
                                       text-xs text-white focus:outline-none focus:border-blue-500 w-48"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <StatusBadge active={ab.active} />
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(ab.created_at + 'Z').toLocaleDateString('es-PE')}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(ab.id)}
                              disabled={editLoading}
                              className="px-2.5 py-1 bg-green-700/60 hover:bg-green-700 text-green-300
                                         text-xs rounded transition-colors disabled:opacity-50"
                            >
                              {editLoading ? '…' : 'Guardar'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2.5 py-1 bg-gray-700/60 hover:bg-gray-700 text-gray-400
                                         text-xs rounded transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <PlateTag plate={ab.plate} />
                        </td>
                        <td className="px-4 py-3 text-gray-200">{ab.name}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge active={ab.active} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(ab.created_at + 'Z').toLocaleDateString('es-PE')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEdit(ab)}
                              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400
                                         text-xs rounded transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => toggleActive(ab)}
                              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                                ab.active
                                  ? 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400'
                                  : 'bg-green-600/20 hover:bg-green-600/40 text-green-400'
                              }`}
                            >
                              {ab.active ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              onClick={() => handleDelete(ab.id)}
                              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400
                                         text-xs rounded transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </>
                    )}
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
