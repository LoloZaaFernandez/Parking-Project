import { useEffect, useState } from 'react'

const API = 'http://localhost:8000'
const PER_PAGE = 20

function Badge({ status }) {
  const map = {
    open:    { cls: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-600/40', label: 'Abierto' },
    waiting: { cls: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-600/40', label: 'Esperando salida' },
    exited:  { cls: 'bg-green-500/15 text-green-400 ring-1 ring-green-600/40',   label: 'Salió' },
    paid:    { cls: 'bg-green-500/15 text-green-400 ring-1 ring-green-600/40',   label: 'Pagado' },
    abono:   { cls: 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-600/40',      label: 'Abonado' },
  }
  const { cls, label } = map[status] ?? { cls: 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-600/40', label: status }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function calcHours(entry, exit) {
  if (!exit) return '—'
  const diff = (new Date(exit + 'Z') - new Date(entry + 'Z')) / 1000
  return Math.ceil(diff / 3600)
}

export default function History() {
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', plate: '', date_from: '', date_to: '' })

  const setFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }))
    setPage(1)
  }

  useEffect(() => {
    const params = new URLSearchParams({ page, per_page: PER_PAGE })
    if (filters.status) params.append('status', filters.status)
    if (filters.plate) params.append('plate', filters.plate)
    if (filters.date_from) params.append('date_from', filters.date_from + 'T00:00:00')
    if (filters.date_to) params.append('date_to', filters.date_to + 'T23:59:59')

    fetch(`${API}/tickets/?${params}`)
      .then((r) => r.json())
      .then((d) => { setTickets(d.items); setTotal(d.total) })
      .catch(() => {})
  }, [page, filters])

  useEffect(() => {
    fetch(`${API}/tickets/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Historial de tickets</h2>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Tickets abiertos" value={stats.open} color="text-yellow-400" />
          <StatCard
            label="Tickets cobrados"
            value={(stats.paid ?? 0) + (stats.exited ?? 0) + (stats.waiting ?? 0)}
            color="text-green-400"
          />
          <StatCard label={`Ingresos hoy (${stats.date})`} value={`S/ ${stats.total_income.toFixed(2)}`} color="text-blue-400" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#1a1d27] rounded-xl p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar placa…"
            value={filters.plate}
            onChange={(e) => setFilter('plate', e.target.value)}
            className="input-field"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="input-field"
          >
            <option value="">Todos los estados</option>
            <option value="open">Abiertos</option>
            <option value="waiting">Esperando salida</option>
            <option value="exited">Salieron</option>
            <option value="paid">Pagados (legado)</option>
            <option value="abono">Abonados</option>
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilter('date_from', e.target.value)}
            className="input-field"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilter('date_to', e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f1117] text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Ingreso</th>
                <th className="px-4 py-3 text-left">Salida</th>
                <th className="px-4 py-3 text-right">Horas</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-gray-800/60 hover:bg-[#0f1117]/40 transition-colors">
                  <td className="px-4 py-3">
                    <span className="bg-yellow-300 text-black font-mono font-black text-xs
                                     px-2 py-0.5 rounded border border-black tracking-wider">
                      {t.plate}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {new Date(t.entry_time + 'Z').toLocaleString('es-PE')}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {t.exit_time ? new Date(t.exit_time + 'Z').toLocaleString('es-PE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {calcHours(t.entry_time, t.exit_time)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {t.amount != null ? (
                      <span className="text-white">S/ {t.amount.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tickets.length === 0 && (
            <div className="text-center py-14 text-gray-600">No hay tickets que mostrar</div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-[#1a1d27] hover:bg-gray-700
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-gray-400 px-2">
            {page} / {totalPages} ({total} tickets)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg bg-[#1a1d27] hover:bg-gray-700
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl p-4 text-center">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  )
}
