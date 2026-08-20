import { useState } from 'react'
import { apiFetch } from '../api'

function Feedback({ feedback }) {
  if (!feedback) return null
  return (
    <div className={`rounded-lg px-3 py-2.5 text-sm border ${
      feedback.type === 'success'
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      {feedback.msg}
    </div>
  )
}

export default function Account() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const inputClass = `w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5
    text-sm text-white placeholder-gray-600
    focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors`

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', msg: 'La nueva contraseña debe tener al menos 6 caracteres' })
      return
    }
    setSaving(true)
    setFeedback(null)
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      setFeedback({ type: 'success', msg: 'Contraseña actualizada correctamente' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setFeedback({ type: 'error', msg: err?.detail ?? 'No se pudo cambiar la contraseña' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-lg font-semibold">Mi cuenta</h2>

      <div className="bg-[#1a1d27] rounded-xl p-6 border border-gray-800 space-y-5">
        <h3 className="text-sm font-medium text-gray-300">Cambiar contraseña</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Contraseña actual
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setFeedback(null) }}
              placeholder="••••••"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setFeedback(null) }}
              placeholder="Mínimo 6 caracteres"
              className={inputClass}
            />
          </div>
          <Feedback feedback={feedback} />
          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40
                       text-white text-sm font-semibold rounded-lg transition-colors
                       disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
