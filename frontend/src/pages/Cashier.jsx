import { useRef, useState } from 'react'
import TicketCard from '../components/TicketCard'

const API = 'http://localhost:8000'

function Receipt({ data, onClose }) {
  return (
    <div
      id="print-receipt"
      className="bg-[#1a1d27] border border-green-700/60 rounded-xl p-6 space-y-4"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-green-400 font-bold text-lg">Pago registrado</h3>
        <p className="text-gray-500 text-xs">
          {new Date().toLocaleString('es-PE')}
        </p>
      </div>

      {/* Details */}
      <div className="border-t border-gray-700 pt-4 space-y-3 text-sm">
        <Row label="Placa">
          <span className="bg-yellow-300 text-black font-mono font-black px-2 py-0.5 rounded border border-black text-sm">
            {data.plate}
          </span>
        </Row>
        <Row label="Ingreso">{new Date(data.entry_time + 'Z').toLocaleString('es-PE')}</Row>
        <Row label="Salida">{new Date(data.exit_time + 'Z').toLocaleString('es-PE')}</Row>
        <Row label="Duración">
          {data.elapsed_hours} hora{data.elapsed_hours !== 1 ? 's' : ''}
        </Row>
        <Row label="Tarifa">S/ {data.rate_per_hour.toFixed(2)} / hora</Row>

        <div className="border-t border-gray-700 pt-3 flex justify-between text-base font-bold">
          <span>Total cobrado</span>
          <span className="text-green-400 text-xl">S/ {data.amount.toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => window.print()}
          className="flex-1 border border-gray-600 hover:border-gray-400 text-gray-300
                     hover:text-white py-2 rounded-lg text-sm transition-colors"
        >
          🖨 Imprimir
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-[#0f1117] hover:bg-gray-800 text-gray-300
                     py-2 rounded-lg text-sm transition-colors"
        >
          Nuevo cobro
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{children}</span>
    </div>
  )
}

export default function Cashier() {
  const [plate, setPlate] = useState('')
  const [ticket, setTicket] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const reset = () => {
    setTicket(null)
    setReceipt(null)
    setError(null)
    setPlate('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const search = async () => {
    const q = plate.trim().toUpperCase()
    if (!q) return
    setLoading(true)
    setError(null)
    setTicket(null)
    setReceipt(null)
    try {
      const res = await fetch(`${API}/tickets/search/${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('Error del servidor')
      const data = await res.json()
      if (!data) {
        setError(`No hay ticket abierto para la placa ${q}`)
      } else {
        setTicket(data)
      }
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const checkout = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/exit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: ticket.plate }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? 'Error al cobrar')
      }
      const data = await res.json()
      setReceipt(data)
      setTicket(null)
      setPlate('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h2 className="text-lg font-semibold">Caja de cobro</h2>

      {/* Search bar */}
      {!receipt && (
        <div className="bg-[#1a1d27] rounded-xl p-5">
          <label className="block text-gray-400 text-sm mb-2">Placa del vehículo</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="ABC-123"
              maxLength={8}
              className="flex-1 bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-3
                         font-mono text-xl text-white placeholder-gray-700 uppercase
                         focus:outline-none focus:border-blue-500 tracking-widest"
            />
            <button
              onClick={search}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                         text-white font-semibold px-5 py-3 rounded-lg transition-colors text-sm"
            >
              {loading ? '…' : 'Buscar'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/25 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Active ticket */}
      {ticket && <TicketCard ticket={ticket} onCheckout={checkout} />}

      {/* Receipt */}
      {receipt && <Receipt data={receipt} onClose={reset} />}
    </div>
  )
}
