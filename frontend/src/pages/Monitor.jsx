import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import PlateDisplay from '../components/PlateDisplay'
import { usePlateSocket } from '../hooks/usePlateSocket'

function StatusDot({ active, configured }) {
  if (configured === false) {
    return (
      <span className="flex items-center gap-1.5 text-sm">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-yellow-400">Esperando configuración de cámara</span>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className={active ? 'text-green-400' : 'text-red-400'}>
        {active ? 'Sistema activo' : 'Desconectado'}
      </span>
    </span>
  )
}

function timeAgo(isoString) {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diffSec < 60) return 'hace un momento'
  const m = Math.floor(diffSec / 60)
  return `hace ${m} min`
}

export default function Monitor() {
  const { connected, lastDetection, recentDetections, recentEntries } = usePlateSocket()
  const [capturing, setCapturing] = useState(false)
  const [flash, setFlash] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [cameraConfigured, setCameraConfigured] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const checkCameraStatus = async () => {
      try {
        const status = await apiFetch('/camera/status')
        if (!cancelled && status) setCameraConfigured(status.configured)
      } catch {
        // ignora — no bloquea el resto del monitor
      }
    }
    checkCameraStatus()
    const id = setInterval(checkCameraStatus, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const visibleEntries = useMemo(
    () => recentEntries.filter((e) => now - new Date(e.timestamp).getTime() < 5 * 60 * 1000),
    [recentEntries, now],
  )

  useEffect(() => {
    if (lastDetection) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1800)
      return () => clearTimeout(t)
    }
  }, [lastDetection])

  const handleCapture = async () => {
    setCapturing(true)
    try {
      await apiFetch('/entry/', { method: 'POST' })
    } catch (err) {
      alert(err.detail ?? 'No se pudo conectar con el servidor')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* ── Panel principal ────────────────────────────────────────────── */}
      <section className="lg:col-span-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Monitor LPR</h2>
          <StatusDot active={connected} configured={cameraConfigured} />
        </div>

        {/* Última detección — panel grande */}
        <div
          className={`bg-[#1a1d27] rounded-xl p-8 flex flex-col items-center justify-center min-h-[220px]
                      transition-all duration-300 ${flash ? 'ring-2 ring-green-500/70 bg-green-900/10' : ''}`}
        >
          {lastDetection ? (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Última placa detectada</p>
              <PlateDisplay plate={lastDetection.plate} size="xl" animate={flash} />
              <div className="flex gap-6 mt-4 text-xs text-gray-500">
                <span>{new Date(lastDetection.timestamp + 'Z').toLocaleTimeString('es-PE')}</span>
                {lastDetection.confidence && (
                  <span>Confianza {Math.round(lastDetection.confidence * 100)}%</span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-600">
              <svg className="w-14 h-14 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">Esperando detección de placa…</p>
            </div>
          )}
        </div>

        <button
          onClick={handleCapture}
          disabled={capturing}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                     disabled:opacity-50 font-semibold text-sm transition-colors"
        >
          {capturing ? 'Capturando…' : 'Capturar ahora'}
        </button>
      </section>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-6">

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Últimas detecciones
          </h3>
          <div className="flex flex-col gap-2">
            {recentDetections.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-6">—</p>
            ) : (
              recentDetections.map((d, i) => (
                <div
                  key={i}
                  className="bg-[#1a1d27] rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <span className="bg-yellow-300 text-black font-mono font-black text-sm
                                   px-2 py-0.5 rounded border border-black tracking-wider">
                    {d.plate}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(d.timestamp + 'Z').toLocaleTimeString('es-PE')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {visibleEntries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Entradas automáticas
            </h3>
            <div className="flex flex-col gap-2">
              {visibleEntries.map((e, i) => (
                <div
                  key={i}
                  className="bg-[#1a1d27] rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{e.is_abonado ? '🔵' : '🚗'}</span>
                    <span className="bg-yellow-300 text-black font-mono font-black text-xs
                                     px-2 py-0.5 rounded border border-black tracking-wider">
                      {e.plate}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {e.is_abonado ? 'abonado' : 'entrada automática'}
                    </span>
                  </div>
                  <span className="text-gray-600 text-xs whitespace-nowrap">
                    {timeAgo(e.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </aside>
    </div>
  )
}
