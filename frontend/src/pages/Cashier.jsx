import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api'
import TicketCard from '../components/TicketCard'
import { usePlateSocket } from '../hooks/usePlateSocket'

// ─── Receipt ──────────────────────────────────────────────────────────────────

function Receipt({ data, onClose }) {
  return (
    <div
      id="print-receipt"
      className="bg-[#1a1d27] border border-green-700/60 rounded-xl p-6 space-y-4"
    >
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

      <div className="border-t border-gray-700 pt-4 space-y-3 text-sm">
        <Row label="Placa">
          <span className="bg-yellow-300 text-black font-mono font-black px-2 py-0.5 rounded border border-black text-sm">
            {data.plate}
          </span>
        </Row>
        <Row label="Ingreso">{new Date(data.entry_time).toLocaleString('es-PE')}</Row>
        <Row label="Salida">{new Date(data.exit_time).toLocaleString('es-PE')}</Row>
        <Row label="Duración">
          {data.elapsed_hours} hora{data.elapsed_hours !== 1 ? 's' : ''}
        </Row>
        <Row label="Tarifa">S/ {data.rate_per_hour.toFixed(2)} / hora</Row>

        <div className="border-t border-gray-700 pt-3 flex justify-between text-base font-bold">
          <span>Total cobrado</span>
          <span className="text-green-400 text-xl">S/ {data.amount.toFixed(2)}</span>
        </div>
      </div>

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

// ─── WaitingCard ──────────────────────────────────────────────────────────────

function WaitingCard({ plate, amount, paidAt, onManualExit, onExited, loading }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    const deadline = new Date(paidAt).getTime() + 15 * 60 * 1000

    const tick = () => {
      const diff = Math.floor((deadline - Date.now()) / 1000)
      setRemaining(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [paidAt])

  const formatCountdown = (secs) => {
    if (secs <= 0) return null
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const expired = remaining !== null && remaining <= 0

  return (
    <div className="bg-[#1a1d27] border border-orange-600/60 rounded-xl p-6 space-y-5">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Vehículo</span>
        <div className="bg-yellow-300 border-2 border-black rounded px-3 py-1">
          <span className="font-mono font-black text-black text-xl tracking-widest">{plate}</span>
        </div>
      </div>

      <div className="bg-orange-500/10 border border-orange-600/40 rounded-xl p-4 text-center space-y-2">
        <p className="text-orange-400 font-bold text-lg">⏳ Esperando salida</p>
        <p className="text-gray-300 text-sm">
          Monto cobrado: <span className="text-white font-bold">S/ {Number(amount).toFixed(2)}</span>
        </p>

        {remaining === null ? null : expired ? (
          <p className="text-red-400 text-sm font-medium animate-pulse">
            ⚠️ Tiempo expirado — recargando...
          </p>
        ) : (
          <p className="text-orange-300 text-sm">
            Tiempo restante:{' '}
            <span className="font-mono font-bold text-orange-200 text-lg">
              {formatCountdown(remaining)}
            </span>
          </p>
        )}
      </div>

      {expired ? (
        <button
          onClick={onExited}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold
                     py-3 rounded-lg transition-colors text-sm"
        >
          Actualizar estado
        </button>
      ) : (
        <button
          onClick={onManualExit}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50
                     text-white font-bold py-3 rounded-lg transition-colors text-sm"
        >
          {loading ? '…' : 'Confirmar salida manual'}
        </button>
      )}
    </div>
  )
}

// ─── AbonadoCard ──────────────────────────────────────────────────────────────

function AbonadoCard({ ticket, onRegister, loading }) {
  return (
    <div className="bg-[#1a1d27] border border-cyan-700/60 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Vehículo</span>
        <div className="bg-yellow-300 border-2 border-black rounded px-3 py-1">
          <span className="font-mono font-black text-black text-xl tracking-widest">
            {ticket.plate}
          </span>
        </div>
      </div>

      <div className="bg-cyan-500/10 border border-cyan-600/40 rounded-xl p-4 text-center space-y-1">
        <p className="text-cyan-400 font-bold text-lg">🔵 Vehículo abonado</p>
        <p className="text-gray-400 text-sm">Sin cargo — acceso incluido en suscripción</p>
        {ticket.entry_time && (
          <p className="text-gray-500 text-xs">
            Ingreso: {new Date(ticket.entry_time).toLocaleTimeString('es-PE')}
          </p>
        )}
      </div>

      <button
        onClick={onRegister}
        disabled={loading}
        className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50
                   text-white font-bold py-3 rounded-lg transition-colors text-sm"
      >
        {loading ? '…' : 'Registrar entrada/salida'}
      </button>
    </div>
  )
}

// ─── ExitSuccess ──────────────────────────────────────────────────────────────

function ExitSuccess({ plate, onClose }) {
  return (
    <div className="bg-[#1a1d27] border border-green-700/60 rounded-xl p-6 text-center space-y-4">
      <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h3 className="text-green-400 font-bold text-lg">✅ Vehículo salió</h3>
        <p className="text-gray-400 text-sm mt-1">
          Salida confirmada para{' '}
          <span className="bg-yellow-300 text-black font-mono font-black px-2 py-0.5 rounded border border-black text-xs">
            {plate}
          </span>
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full bg-[#0f1117] hover:bg-gray-800 text-gray-300
                   py-2 rounded-lg text-sm transition-colors"
      >
        Nuevo cobro
      </button>
    </div>
  )
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{children}</span>
    </div>
  )
}

// ─── Plate formatter ──────────────────────────────────────────────────────────

function formatPlateInput(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!clean) return ''
  // AB-XXXX: cuando el 3er caracter es dígito (ej: AB-1234)
  if (clean.length >= 3 && /[0-9]/.test(clean[2])) {
    const digits = clean.slice(2, 6)
    return digits ? clean.slice(0, 2) + '-' + digits : clean.slice(0, 2)
  }
  // ABC-XXX: 3 letras + 3 dígitos (ej: ABC-123)
  const digits = clean.slice(3, 6)
  return digits ? clean.slice(0, 3) + '-' + digits : clean.slice(0, 3)
}

// ─── Cashier states ───────────────────────────────────────────────────────────
// idle | found_open | found_waiting | found_abono | not_found | exited

export default function Cashier() {
  const [plate, setPlate] = useState('')
  const [state, setState] = useState('idle')
  const [ticket, setTicket] = useState(null)
  const [waitingData, setWaitingData] = useState(null)  // { plate, amount, paid_at }
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const currentPlate = useRef('')
  const inputRef = useRef(null)

  const { lastAction } = usePlateSocket()

  // ── React to WebSocket actions ──────────────────────────────────────────────
  useEffect(() => {
    if (!lastAction) return

    if (lastAction.plate !== currentPlate.current) return

    if (lastAction.type === 'exit_confirmed') {
      setState('exited')
      setWaitingData(null)
      setTicket(null)
    }

    if (lastAction.type === 'payment_expired' && state === 'found_waiting') {
      // Payment window expired — ticket reverted to open, re-fetch
      fetchTicket(currentPlate.current)
    }
  }, [lastAction]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = () => {
    setState('idle')
    setTicket(null)
    setWaitingData(null)
    setReceipt(null)
    setError(null)
    setPlate('')
    currentPlate.current = ''
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ── Fetch ticket by plate ───────────────────────────────────────────────────
  const fetchTicket = async (q) => {
    setLoading(true)
    setError(null)
    setTicket(null)
    setWaitingData(null)
    setReceipt(null)

    try {
      // Try the status endpoint first to get richer data including paid_at
      const data = await apiFetch(`/tickets/status/${encodeURIComponent(q)}`)

      if (!data) {
        setState('not_found')
        return
      }

      if (data.status === 'waiting') {
        setWaitingData({ plate: data.plate, amount: data.amount, paid_at: data.paid_at })
        setState('found_waiting')
        return
      }

      if (data.status === 'abono') {
        setTicket(data)
        setState('found_abono')
        return
      }

      if (data.status === 'open') {
        setTicket(data)
        setState('found_open')
        return
      }

      // Closed/exited ticket — no open ticket
      setState('not_found')
    } catch {
      // Fall back to old search endpoint if status endpoint doesn't exist yet
      try {
        const data = await apiFetch(`/tickets/search/${encodeURIComponent(q)}`)

        if (!data) {
          setState('not_found')
          return
        }

        if (data.status === 'abono') {
          setTicket(data)
          setState('found_abono')
        } else {
          setTicket(data)
          setState('found_open')
        }
      } catch {
        setError('No se pudo conectar con el servidor')
        setState('idle')
      }
    } finally {
      setLoading(false)
    }
  }

  const search = () => {
    const q = plate.trim().toUpperCase()
    if (!q) return
    currentPlate.current = q
    fetchTicket(q)
  }

  // ── Checkout (open → waiting) ───────────────────────────────────────────────
  const checkout = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/exit/', {
        method: 'POST',
        body: JSON.stringify({ plate: ticket.plate }),
      })

      if (data.status === 'waiting') {
        // New flow: paid, now waiting for physical exit
        setWaitingData({ plate: data.plate, amount: data.amount, paid_at: data.paid_at })
        setTicket(null)
        setState('found_waiting')
      } else {
        // Legacy: immediate exit
        setReceipt(data)
        setTicket(null)
        setState('idle') // receipt takes over
      }
    } catch (err) {
      setError(err.detail ?? 'Error al cobrar')
    } finally {
      setLoading(false)
    }
  }

  // ── Manual exit confirmation ────────────────────────────────────────────────
  const confirmManualExit = async () => {
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/exit/confirm', {
        method: 'POST',
        body: JSON.stringify({ plate: waitingData.plate }),
      })
      setState('exited')
      setWaitingData(null)
    } catch (err) {
      setError(err.detail ?? 'Error al confirmar salida')
    } finally {
      setLoading(false)
    }
  }

  // ── Abonado register exit ───────────────────────────────────────────────────
  const registerAbono = async () => {
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/exit/', {
        method: 'POST',
        body: JSON.stringify({ plate: ticket.plate }),
      })
      setState('exited')
      setTicket(null)
    } catch (err) {
      setError(err.detail ?? 'Error al registrar salida')
    } finally {
      setLoading(false)
    }
  }

  // ── Receipt from legacy immediate-exit flow ─────────────────────────────────
  const showingReceipt = receipt != null

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h2 className="text-lg font-semibold">Caja de cobro</h2>

      {/* Search bar — hide when showing receipt, exited, or waiting */}
      {!showingReceipt && state !== 'exited' && (
        <div className="bg-[#1a1d27] rounded-xl p-5">
          <label className="block text-gray-400 text-sm mb-2">Placa del vehículo</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={plate}
              onChange={(e) => setPlate(formatPlateInput(e.target.value))}
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

      {/* Not found */}
      {state === 'not_found' && (
        <div className="bg-[#1a1d27] border border-gray-700 rounded-xl p-6 text-center space-y-3">
          <p className="text-gray-400 text-sm">
            No hay ticket abierto para la placa{' '}
            <span className="bg-yellow-300 text-black font-mono font-black px-2 py-0.5 rounded border border-black text-xs">
              {currentPlate.current}
            </span>
          </p>
          <button
            onClick={reset}
            className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
          >
            Buscar otra placa
          </button>
        </div>
      )}

      {/* Open ticket */}
      {state === 'found_open' && ticket && (
        <div className="space-y-3">
          <TicketCard ticket={ticket} onCheckout={checkout} />
          {loading && (
            <p className="text-center text-gray-500 text-sm">Procesando pago…</p>
          )}
        </div>
      )}

      {/* Waiting for physical exit */}
      {state === 'found_waiting' && waitingData && (
        <WaitingCard
          plate={waitingData.plate}
          amount={waitingData.amount}
          paidAt={waitingData.paid_at}
          onManualExit={confirmManualExit}
          onExited={() => fetchTicket(currentPlate.current)}
          loading={loading}
        />
      )}

      {/* Abonado vehicle */}
      {state === 'found_abono' && ticket && (
        <AbonadoCard ticket={ticket} onRegister={registerAbono} loading={loading} />
      )}

      {/* Exit confirmed via WS or manual confirm */}
      {state === 'exited' && (
        <ExitSuccess plate={currentPlate.current} onClose={reset} />
      )}

      {/* Legacy receipt (immediate-exit backend) */}
      {showingReceipt && <Receipt data={receipt} onClose={reset} />}
    </div>
  )
}
