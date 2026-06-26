import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2]

function currency(n) {
  return `S/ ${Number(n ?? 0).toFixed(2)}`
}

function duration(minutes) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function TypeBadge({ type }) {
  const isAbonado = type === 'abonado'
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        isAbonado
          ? 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-600/40'
          : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-600/40'
      }`}
    >
      {isAbonado ? 'Abonado' : 'Normal'}
    </span>
  )
}

function MonthDetail({ year, month, monthName, onClose }) {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const LIMIT = 50

  function load(p) {
    setLoading(true)
    apiFetch(`/reports/monthly/${year}/${month}?page=${p}&limit=${LIMIT}`)
      .then((d) => {
        setData(d)
        setPage(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="bg-[#1a1d27] border border-blue-500/30 rounded-xl overflow-hidden">
      {/* Detail header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <h3 className="font-semibold text-white">
            Detalle — {monthName} {year}
          </h3>
          {data?.summary && (
            <p className="text-gray-500 text-xs mt-0.5">
              {data.total} tickets · Ingresos: {currency(data.summary.total_income)}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors text-lg leading-none px-1"
          aria-label="Cerrar detalle"
        >
          ×
        </button>
      </div>

      {/* Summary strip */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800">
          {[
            { label: 'Vehículos', value: data.summary.total_vehicles, color: 'text-white' },
            { label: 'Pagantes', value: data.summary.paying_vehicles, color: 'text-blue-400' },
            { label: 'Abonados', value: data.summary.abonado_vehicles, color: 'text-purple-400' },
            { label: 'Duración media', value: duration(data.summary.avg_duration_minutes), color: 'text-gray-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0f1117] px-4 py-3">
              <p className="text-gray-600 text-xs">{label}</p>
              <p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tickets table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0f1117] text-gray-500 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Placa</th>
              <th className="px-4 py-3 text-left">Ingreso</th>
              <th className="px-4 py-3 text-left">Salida</th>
              <th className="px-4 py-3 text-right">Duración</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-center">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-600">Cargando…</td>
              </tr>
            ) : !data?.tickets?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-600">
                  No hay tickets en este período
                </td>
              </tr>
            ) : (
              data.tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-gray-800/60 hover:bg-[#0f1117]/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="bg-yellow-300 text-black font-mono font-black text-xs px-2 py-0.5 rounded border border-black tracking-wider">
                      {t.plate}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-xs">
                    {t.entry_time ? new Date(t.entry_time + 'Z').toLocaleString('es-PE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {t.exit_time ? new Date(t.exit_time + 'Z').toLocaleString('es-PE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 text-xs">
                    {duration(t.duration_minutes)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {t.amount != null ? (
                      <span className="text-white">{currency(t.amount)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TypeBadge type={t.ticket_type ?? (t.is_abonado ? 'abonado' : 'normal')} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm px-4 py-4 border-t border-gray-800">
          <button
            onClick={() => load(page - 1)}
            disabled={page === 1 || loading}
            className="px-3 py-1.5 rounded-lg bg-[#0f1117] hover:bg-gray-700
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
          >
            ← Anterior
          </button>
          <span className="text-gray-400 text-xs px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page === totalPages || loading}
            className="px-3 py-1.5 rounded-lg bg-[#0f1117] hover:bg-gray-700
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [monthly, setMonthly] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openMonth, setOpenMonth] = useState(null) // { month, month_name }

  useEffect(() => {
    setLoading(true)
    setError('')
    setOpenMonth(null)
    apiFetch(`/reports/monthly?year=${year}`)
      .then(setMonthly)
      .catch(() => setError('No se pudieron cargar los reportes'))
      .finally(() => setLoading(false))
  }, [year])

  function handleMonthClick(row) {
    if (openMonth?.month === row.month) {
      setOpenMonth(null)
    } else {
      setOpenMonth({ month: row.month, month_name: row.month_name })
    }
  }

  const totalIncome = monthly.reduce((acc, r) => acc + (r.total_income ?? 0), 0)
  const totalVehicles = monthly.reduce((acc, r) => acc + (r.total_vehicles ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reportes mensuales</h2>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-[#1a1d27] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                     focus:outline-none focus:border-blue-500 transition-colors"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Annual summary */}
      {!loading && monthly.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1a1d27] rounded-xl p-4 border border-gray-800 text-center">
            <p className="text-gray-500 text-xs mb-1">Ingresos {year}</p>
            <p className="text-2xl font-black text-green-400">{currency(totalIncome)}</p>
          </div>
          <div className="bg-[#1a1d27] rounded-xl p-4 border border-gray-800 text-center">
            <p className="text-gray-500 text-xs mb-1">Vehículos {year}</p>
            <p className="text-2xl font-black text-blue-400">{totalVehicles}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Monthly table */}
      <div className="bg-[#1a1d27] rounded-xl overflow-hidden border border-gray-800">
        {loading ? (
          <div className="text-center py-12 text-gray-600">Cargando…</div>
        ) : monthly.length === 0 ? (
          <div className="text-center py-12 text-gray-600">No hay datos para {year}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f1117] text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Mes</th>
                  <th className="px-4 py-3 text-right">Total vehículos</th>
                  <th className="px-4 py-3 text-right">Pagantes</th>
                  <th className="px-4 py-3 text-right">Abonados</th>
                  <th className="px-4 py-3 text-right">Duración media</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => {
                  const isOpen = openMonth?.month === row.month
                  return (
                    <tr
                      key={row.month}
                      onClick={() => handleMonthClick(row)}
                      className={`border-t border-gray-800/60 cursor-pointer transition-colors ${
                        isOpen
                          ? 'bg-blue-600/10 hover:bg-blue-600/15'
                          : 'hover:bg-[#0f1117]/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                        <span
                          className={`text-xs transition-transform inline-block ${isOpen ? 'rotate-90' : ''}`}
                        >
                          ▶
                        </span>
                        {row.month_name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{row.total_vehicles}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{row.paying_vehicles}</td>
                      <td className="px-4 py-3 text-right text-purple-400">{row.abonado_vehicles}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {duration(row.avg_duration_minutes)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-400">
                        {currency(row.total_income)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Month detail panel */}
      {openMonth && (
        <MonthDetail
          year={year}
          month={openMonth.month}
          monthName={openMonth.month_name}
          onClose={() => setOpenMonth(null)}
        />
      )}
    </div>
  )
}
