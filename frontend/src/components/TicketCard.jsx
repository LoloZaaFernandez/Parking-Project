import { useEffect, useState } from 'react'

function calcElapsed(entryIso) {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(entryIso).getTime()) / 1000))
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function calcAmount(entryIso, rate) {
  const diffSec = (Date.now() - new Date(entryIso).getTime()) / 1000
  const hours = Math.ceil(diffSec / 3600)
  return (hours * rate).toFixed(2)
}

export default function TicketCard({ ticket, onCheckout }) {
  const [elapsed, setElapsed] = useState(calcElapsed(ticket.entry_time))
  const [amount, setAmount] = useState(calcAmount(ticket.entry_time, ticket.rate_per_hour))

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(calcElapsed(ticket.entry_time))
      setAmount(calcAmount(ticket.entry_time, ticket.rate_per_hour))
    }, 1000)
    return () => clearInterval(timer)
  }, [ticket.entry_time, ticket.rate_per_hour])

  return (
    <div className="bg-[#1a1d27] border border-gray-700 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Vehículo</span>
        <div className="bg-yellow-300 border-2 border-black rounded px-3 py-1">
          <span className="font-mono font-black text-black text-xl tracking-widest">
            {ticket.plate}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 mb-0.5">Hora de ingreso</p>
          <p className="text-white font-medium">
            {new Date(ticket.entry_time).toLocaleTimeString('es-PE')}
          </p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Tiempo transcurrido</p>
          <p className="text-blue-400 font-mono text-lg font-bold">{elapsed}</p>
        </div>
      </div>

      <div className="bg-[#0f1117] rounded-lg p-4 text-center">
        <p className="text-gray-500 text-xs mb-1">Monto estimado</p>
        <p className="text-green-400 text-4xl font-black">S/ {amount}</p>
        <p className="text-gray-600 text-xs mt-1">S/ {ticket.rate_per_hour.toFixed(2)} / hora · hora completa</p>
      </div>

      {onCheckout && (
        <button
          onClick={onCheckout}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                     text-white font-bold py-3 rounded-lg transition-colors text-sm"
        >
          Cobrar y cerrar ticket
        </button>
      )}
    </div>
  )
}
